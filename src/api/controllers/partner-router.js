/**
 * See partner-link.service.js for an explanation why these endpoints are kept separate.
 */

import * as R from 'ramda'
import * as express from 'express'
import * as http from 'http'

// See notes on usage of these, since we need to beware permissions when using them
import ClaimService from '../services/claim.service'
import { dbService as endorserDbService } from "../services/endorser.db.service";

import { sendAndStoreLink } from "../services/partner-link.service";
import { dbService as partnerDbService } from "../services/partner.db.service";
import embeddingsService, { embeddingToStorageString } from "../services/embeddings.service";
import { matchParticipants, buildParticipantsFromRows } from "../services/matching.service";
import { EMBEDDING_FOR_EMPTY_STRING } from "../services/embedding-empty-string";
import { getAllDidsBetweenRequesterAndObjects, nearestNeighborsTo } from "../services/network-cache.service";
import {HIDDEN_TEXT, latLonFromTile, latWidthToTileWidth, mergeTileCounts} from '../services/util';

/**
 * Update membership details for given member
 *
 * @param {number} memberId - member ID
 * @param {object} member - member record
 * @param {object} bodyData: properties: "content" - new content (member only), "admitted" - admission status (organizer only)
 * @param {object} res - the Response object
 * @returns {object} - success response
 */
async function updateGroupMember(memberId, member, bodyData, res) {
  if (!member) {
    return res.status(404).json({ error: "Member not found" }).end()
  }
  if (memberId !== member.memberId) {
    return res.status(404).json({ error: "Cannot update using a different member ID '" + memberId + "' than the member's memberId '" + member.memberId + "'" }).end()
  }

  const group = await partnerDbService.groupOnboardGetByRowId(member.groupId)
  if (!group) {
    return res.status(404).json({ error: "Group not found" }).end()
  }
  if (group.expiresAt && group.expiresAt < Date.now()) {
    return res.status(404).json({ error: { userMessage: "That meeting has expired." } }).end()
  }

  const isMember = res.locals.authTokenIssuer === member.issuerDid
  const isOrganizer = res.locals.authTokenIssuer === group.issuerDid

  if (!isMember && !isOrganizer) {
    return res.status(403).json({ error: { userMessage: "You are not authorized to update this member." } }).end()
  }

  const result = {}
  if (isMember && bodyData.content) {
    const updated = await partnerDbService.groupOnboardMemberUpdateContent(memberId, bodyData.content)
    if (updated === 0) {
      return res.status(404).json({ error: "That member ID could not be updated with content." }).end()
    }
    if (bodyData.admitted !== undefined) {
      result.message = "Only the organizer can update member admission status."
    }
  }

  if (isOrganizer && bodyData.admitted !== undefined) {
    if (memberId === res.locals.authTokenIssuer) {
      // organizer cannot revoke their own admission
      return res.status(403).json({ error: { userMessage: "As organizer, you cannot revoke your own admission." } }).end()
    }
    const updated = await partnerDbService.groupOnboardMemberUpdateAdmitted(memberId, bodyData.admitted)
    if (updated === 0) {
      return res.status(404).json({ error: { userMessage: "That member ID could not be updated with admission status." } }).end()
    }
    if (bodyData.content) {
      result.message = "Only the member can update their content."
    }
  }

  result.success = true
  return res.status(200).json(result).end()
}

/**
 * Check if a DID is in the admin user array
 * @param {string} issuerDid - the DID to check
 * @returns {boolean} true if the DID is an admin
 */
function isAdminUser(issuerDid) {
  const adminUsers = process.env.ADMIN_DIDS
  if (!adminUsers) {
    return false
  }
  // ADMIN_DIDS is a comma-separated list of DIDs
  const adminList = JSON.parse(adminUsers)
  return adminList.includes(issuerDid)
}

/**
 * Ensure profile embedding is generated/stored when generateEmbedding flag is set,
 * or deleted when flag is cleared.
 * @param {string} issuerDid - the profile owner's DID
 */
async function ensureProfileEmbedding(issuerDid) {
  const profile = await partnerDbService.profileByIssuerDid(issuerDid)
  const profileRowId = profile?.rowId ?? profile?.rowid

  if (!profile?.generateEmbedding) {
    await partnerDbService.profileEmbeddingDeleteByProfileRowId(profileRowId)
    return
  }

  const embedding = await embeddingsService.generateEmbedding(profile.description)
  const vectorStr = embeddingsService.embeddingToStorageString(embedding)
  await partnerDbService.profileEmbeddingInsertOrUpdate(profileRowId, vectorStr)
}

/**
 * Make an API call to /api/claim/:jwtId
 * @param {string} jwtId - the JWT ID to retrieve
 * @param {string} authHeader - the Authorization header value to forward
 * @returns {Promise<object>} - the JWT info
 */
function getClaimById(jwtId, authHeader) {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || 80
    const host = 'localhost'
    const path = `/api/claim/${jwtId}`
    
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      headers: {}
    }
    
    if (authHeader) {
      options.headers['Authorization'] = authHeader
    }
    
    const req = http.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data)
            resolve(result)
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`))
          }
        } else if (res.statusCode === 404) {
          reject(new Error('Claim not found'))
        } else {
          reject(new Error(`API call failed with status ${res.statusCode}: ${data}`))
        }
      })
    })
    
    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`))
    })
    
    req.end()
  })
}

/**
 * Make an API call to /api/report/rateLimits
 * @param {string} authHeader - the Authorization header value to forward
 * @returns {Promise<object>} - the rate limits info
 */
function getRateLimits(authHeader) {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || 80
    const host = 'localhost'
    const path = '/api/report/rateLimits'
    
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      headers: {}
    }
    
    if (authHeader) {
      options.headers['Authorization'] = authHeader
    }
    
    const req = http.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data)
            resolve(result)
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`))
          }
        } else if (res.statusCode === 400) {
          // Rate limits endpoint returns 400 if user doesn't have an account
          const error = new Error('Must be registered')
          error.clientError = true
          reject(error)
        } else {
          reject(new Error(`API call failed with status ${res.statusCode}: ${data}`))
        }
      })
    })
    
    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`))
    })
    
    req.end()
  })
}



export default express
.Router()
.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  next();
})

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

// similar code is in report-router.js
/**
 * @typedef LocationCount
 * @property {number} indexLat - minimum latitude of this tile
 * @property {number} indexLon - minimum longitude of this tile
 * @property {number} minFoundLat - lowest latitude of matches found in this tile
 * @property {number} minFoundLon - westernmost longitude of matches found in this tile
 * @property {number} maxFoundLat - highest latitude of matches found in this tile
 * @property {number} maxFoundLon - easternmost longitude of matches found in this tile
 * @property {number} recordCount - number of records found in this tile
 */

// similar code is in report-router.js
/**
 * @typedef GridCounts
 * @property {array.LocationCount} tiles - counts of records in each tile of the grid
 * @property {number} minGridLat - minimum latitude of the searched area (which may be outside the bounding box)
 * @property {number} minGridLon - minimum longitude of the searched area (which may be outside the bounding box)
 * @property {number} tileWidth - width of each tile
 * @property {number} numTilesWide - number of tiles wide for the searched area
 */

/**
 * @typedef UserProfile
 * @property {string} issuerDid - the DID of the user
 * @property {string} issuerDidVisibleToDids - if issuerDid is a HIDDEN value, this has DIDs who can see the issuer DID
 * @property {string} description - free-form description of interests
 * @property {number} locLat - latitude coordinate
 * @property {number} locLon - longitude coordinate
 * @property {number} locLat2 - latitude coordinate
 * @property {number} locLon2 - longitude coordinate
 * @property {string} rowId - the profile ID
 * @property {string} createdAt - date the profile was created
 * @property {boolean} generateEmbedding - whether to always generate embedding vectors for this user
 * (only set by admins, and might only be visible to admins)
 */

/**
 * @typedef MatchPairParticipant
 * @property {string} issuerDid - the DID of the participant
 * @property {string} content - the encrypted content of the participant
 * @property {string} description - the description of the participant's profile
 */

/**
 * @typedef MatchPairs
 * @property {number} pairNumber - the number of the pair
 * @property {number} similarity - the similarity score of the pair
 * @property {MatchPairParticipant[]} participants - the participants in the pair
 */

/**
 * Add a link to some partner service
 *
 * @group partner utils
 * @route POST /api/partner/link
 * @param {string} jwtId.body.required - the claim to relay to the partner
 * @param {string} linkCode.body.required - the partner link code, eg. 'NOSTR-EVENT' (or someday: 'ATTEST.SH')
 * @returns 201 - success
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.post(
  '/link',
  async (req, res) => {

    try {
      // When we separate this into another service, this will have to be an API call.
      // See the image-api server for an example of how to leverage JWTs to get
      // permission to access data from the other service.
      const jwtInfo = await endorserDbService.jwtById(req.body.jwtId)
      // Here's the approach we'd like to use:
      // const authHeader = req.headers['authorization'] || req.headers['Authorization']
      // const jwtInfo = await getClaimById(req.body.jwtId, authHeader)

      const result =
        await sendAndStoreLink(
          res.locals.authTokenIssuer,
          jwtInfo,
          req.body.linkCode,
          req.body.inputJson,
          req.body.pubKeyHex || req.body.nostrPubKeyHex, // the latter was only used for a short time
          req.body.pubKeyImage,
          req.body.pubKeySigHex,
        )
      if (result.clientError) {
        res.status(400).json({ error: result.clientError }).end()
      } else if (result.error) {
        // this is a server error, not a client error; we assume something went to the logs inside the method call
        res.status(500).json({ error: result }).end()
      } else {
        res.status(201).json({ success: { signedEvent: result.signedEvent } }).end()
      }
    } catch (err) {
      console.error('Error adding partner link for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Add a profile for a user
 *
 * @group partner utils
 * @route POST /api/partner/profile
 * @param {string} description.body.required - free-form description of interests
 * @param {number} latitude.body.optional - latitude coordinate
 * @param {number} longitude.body.optional - longitude coordinate
 * @param {number} latitude2.body.optional - latitude coordinate
 * @param {number} longitude2.body.optional - longitude coordinate
 * @returns 201 - success
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.post(
  '/userProfile',
  async (req, res) => {
    const { description, locLat, locLon, locLat2, locLon2 } = req.body

    // When we separate this into another service, this will have to be an API call.
    // See the image-api server for an example of how to leverage JWTs to get
    // permission to access data from the other service.
    try {
      await ClaimService.getRateLimits(res.locals.authTokenIssuer)
      // Here's the approach we'd like to use:
      // const authHeader = req.headers['authorization'] || req.headers['Authorization']
      // await getRateLimits(authHeader)
    } catch (e) {
      // must not have an account
      return res.status(400).json({ error: { userMessage: "Must be registered to submit a profile" } }).end()
    }

    // Validate inputs
    if (!res.locals.authTokenIssuer) {
      return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
    }
    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: "Query parameter 'description' must be a string" }).end()
    }
    if (locLat && (typeof locLat !== 'number' || locLat < -90 || locLat > 90)) {
      return res.status(400).json({ error: "Query parameter 'locLat' must be a number between -90 and 90" }).end()
    }
    if (locLon && (typeof locLon !== 'number' || locLon < -180 || locLon > 180)) {
      return res.status(400).json({ error: "Query parameter 'locLon' must be a number between -180 and 180" }).end()
    }
    if (locLat2 && (typeof locLat2 !== 'number' || locLat2 < -90 || locLat2 > 90)) {
      return res.status(400).json({ error: "Query parameter 'locLat2' must be a number between -90 and 90" }).end()
    }
    if (locLon2 && (typeof locLon2 !== 'number' || locLon2 < -180 || locLon2 > 180)) {
      return res.status(400).json({ error: "Query parameter 'locLon2' must be a number between -180 and 180" }).end()
    }

    try {
      const entry = {
        issuerDid: res.locals.authTokenIssuer,
        description,
        locLat,
        locLon,
        locLat2,
        locLon2
      }

      const userProfileId = await partnerDbService.profileInsertOrUpdate(entry)

      // Generate embedding in background if generateEmbedding flag is set
      ensureProfileEmbedding(res.locals.authTokenIssuer).catch((err) => {
        console.error('Error generating profile embedding for DID:', res.locals.authTokenIssuer, err)
        res.status(500).json({ error: err.message }).end()
      })

      res.status(201).json({ success: { userProfileId } }).end()
    } catch (err) {
      console.error('Error adding user profile for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)


/**
 * Get a user's profile
 *
 * @group partner utils
 * @route GET /api/partner/userProfileForIssuer/{issuerDid}
 * @param {string} issuerDid.path.required - the issuer DID to get the profile for
 * @returns {UserProfile} 200 - success response with profile
 * @returns {Error} 403 - unauthorized
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfileForIssuer/:issuerDid',
  async (req, res) => {
    const { issuerDid } = req.params
    try {
      let result = await partnerDbService.profileByIssuerDid(issuerDid)

      // use this message for not visible profiles as well so as to not leak information about this DID attached to any profile
      const NOT_SEEN_MESSAGE = "There is no profile for this issuer or it is not visible to you."
      if (!result) {
        return res.status(404).json({ error: NOT_SEEN_MESSAGE }).end()
      }
      if (issuerDid !== res.locals.authTokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
        // (When we separate this into another service, this will have to be an API call.
        // See the image-api server for an example of how to leverage JWTs to get
        // permission to access data from the other service.)
        const didsSeenByRequesterWhoSeeObject =
          await getAllDidsBetweenRequesterAndObjects(res.locals.authTokenIssuer, [issuerDid])
        if (didsSeenByRequesterWhoSeeObject[0] === issuerDid) {
          // the issuerDid is visible to the requester, so continue with full content
        } else {
          // someone the issuer can see can see the profile,
          // but giving up all between would expose their full network
          return res.status(404).json({ error: NOT_SEEN_MESSAGE }).end()
        }
      }
      result.hasEmbedding = await partnerDbService.profileHasEmbedding(result.rowId)
      res.status(200).json({ data: result }).end()
    } catch (err) {
      console.error('Error getting user profile for issuer:', issuerDid, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get a user's profile by ID
 *
 * @group partner utils
 * @route GET /api/partner/userProfile/{id}
 * @param {number} rowId.path.required - the profile ID to retrieve
 * @returns {UserProfile} 200 - success response with profile
 * @returns {Error} 403 - unauthorized
 * @returns {Error} 404 - not found
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfile/:rowId',
  async (req, res) => {
    const { rowId } = req.params
    const rowIdInt = parseInt(rowId)
    try {
      let result = await partnerDbService.profileById(rowIdInt)

      if (!result) {
        return res.status(404).json({ error: "Profile not found" }).end()
      }

      if (result.issuerDid !== res.locals.authTokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
        // (When we separate this into another service, this will have to be an API call.
        // See the image-api server for an example of how to leverage JWTs to get
        // permission to access data from the other service.)
        const didsSeenByRequesterWhoSeeObject =
          await getAllDidsBetweenRequesterAndObjects(res.locals.authTokenIssuer, [result.issuerDid])
        if (didsSeenByRequesterWhoSeeObject[0] === result.issuerDid) {
          // the issuerDid is visible to the requester, so continue with full content
        } else {
          // maybe someone the issuer can see can see the profile,
          // and the profile ID doesn't give up any ID info so share
          result = {
            ...result,
            issuerDid: HIDDEN_TEXT,
            issuerDidVisibleToDids: didsSeenByRequesterWhoSeeObject[0],
          }
        }
      }
      result.hasEmbedding = await partnerDbService.profileHasEmbedding(rowIdInt)
      res.status(200).json({ data: result }).end()
    } catch (err) {
      console.error('Error getting user profile by ID:', rowId, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Search for profiles by location or text
 *
 * @group partner utils
 * @route GET /api/partner/userProfile
 * @param {number} minLocLat.query.optional - minimum latitude coordinate
 * @param {number} minLocLon.query.optional - minimum longitude coordinate
 * @param {number} maxLocLat.query.optional - maximum latitude coordinate
 * @param {number} maxLocLon.query.optional - maximum longitude coordinate
 * @param {string} claimContents.query.optional - text to search in description
 * @param {string} beforeId.query.optional - return profiles with rowId less than this
 * @param {string} afterId.query.optional - return profiles with rowId greater than this
 * @returns {array.UserProfile} 200 - success response with profiles
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfile',
  async (req, res, next) => {
    const { minLocLat, minLocLon, maxLocLat, maxLocLon, claimContents, beforeId, afterId } = req.query
    try {

      const numMinLat = minLocLat ? Number(minLocLat) : null
      const numMinLon = minLocLon ? Number(minLocLon) : null
      const numMaxLat = maxLocLat ? Number(maxLocLat) : null
      const numMaxLon = maxLocLon ? Number(maxLocLon) : null

      if (!res.locals.authTokenIssuer) {
        res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
        return
      }
      if (minLocLat && (isNaN(numMinLat) || numMinLat < -90 || numMinLat > 90)) {
        res.status(400).json({ error: "Query parameter 'minLocLat' must be a number between -90 and 90" }).end()
        return
      }
      if (minLocLon && (isNaN(numMinLon) || numMinLon < -180 || numMinLon > 180)) {
        res.status(400).json({ error: "Query parameter 'minLocLon' must be a number between -180 and 180" }).end()
        return
      }
      if (maxLocLat && (isNaN(numMaxLat) || numMaxLat < -90 || numMaxLat > 90)) {
        res.status(400).json({ error: "Query parameter 'maxLocLat' must be a number between -90 and 90" }).end()
        return
      }
      if (maxLocLon && (isNaN(numMaxLon) || numMaxLon < -180 || numMaxLon > 180)) {
        res.status(400).json({ error: "Query parameter 'maxLocLon' must be a number between -180 and 180" }).end()
        return
      }

      const rawResult = await partnerDbService.profilesByLocationAndContentsPaged(
        numMinLat,
        numMinLon,
        numMaxLat,
        numMaxLon,
        beforeId,
        afterId,
        claimContents
      )
      const resultList = rawResult.data
      // Hide DIDs and add network links
      // This doesn't use the same "hide" functions built into other services because we expect to split this out someday.
      // (When we separate this into another service, this will have to be an API call.
      // See the image-api server for an example of how to leverage JWTs to get
      // permission to access data from the other service.)
      const didsSeenByRequesterWhoSeeObject =
        await getAllDidsBetweenRequesterAndObjects(res.locals.authTokenIssuer, resultList.map(profile => profile.issuerDid))
      // for each profile, if the issuerDid is not visible to the requester, add the list of DIDs who can see that DID
      const resultsScrubbed = []
      for (let i = 0; i < resultList.length; i++) {
        const profile = resultList[i]
        const didOrDidsSeenByRequesterWhoSeeObject = didsSeenByRequesterWhoSeeObject[i]
        if (didOrDidsSeenByRequesterWhoSeeObject === profile.issuerDid) {
          // the issuerDid is visible to the requester
          resultsScrubbed.push(profile)
        } else {
          // the issuerDid is not visible to the requester
          profile.issuerDid = HIDDEN_TEXT
          // didOrDidsSeenByRequesterWhoSeeObject must be an array of DIDs who can see the target DID
          const didsWhoSeeObject =
            R.isEmpty(didOrDidsSeenByRequesterWhoSeeObject)
              ? undefined
              : didOrDidsSeenByRequesterWhoSeeObject
          resultsScrubbed.push({
            ...profile,
            issuerDidVisibleToDids: didsWhoSeeObject
          })
        }
      }
      const fullResult = {
        data: resultsScrubbed,
        hitLimit: rawResult.hitLimit
      }
      res.status(200).json(fullResult).end()
    } catch (err) {
      console.error('Error getting user profiles from search:', err, '... for params:', JSON.stringify({ minLocLat, minLocLon, maxLocLat, maxLocLon, claimContents, beforeId, afterId }))
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Delete a user's profile
 *
 * @group partner utils
 * @route DELETE /api/partner/userProfile
 * @returns 200 - success response with number of deleted profiles
 * @returns {Error} 500 - server error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.delete(
  '/userProfile',
  async (req, res) => {
    try {
      if (!res.locals.authTokenIssuer) {
        return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
      }
      const result = await partnerDbService.profileDelete(res.locals.authTokenIssuer)
      res.status(204).json({ success: { numDeleted: result } }).end()
    } catch (err) {
      console.error('Error deleting user profile for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update the generateEmbedding flag for a user profile (permissioned users only)
 *
 * @group partner utils
 * @route PUT /api/partner/userProfile/generateEmbedding/{issuerDid}
 * @param {string} issuerDid.path.required - the DID of the user whose profile to update
 * @returns 200 - success response
 * @returns {Error} 403 - unauthorized (not an admin)
 * @returns {Error} 404 - profile not found
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.put(
  '/userProfileGenerateEmbedding/:profileDid',
  async (req, res) => {
    const { profileDid } = req.params
    try {
      if (!res.locals.authTokenIssuer) {
        return res.status(400).json({ error: "The request must include a valid Authorization JWT." }).end()
      }

      // Check if requester is an admin
      if (!isAdminUser(res.locals.authTokenIssuer)) {
        return res.status(403).json({ error: "Only permissioned users can update the generateEmbedding flag." }).end()
      }

      // We're currently not checking that the issuer can see this profile DID.
      // We're assuming that permissioned users will not abuse this.
      // (We considered checking visibility but that approach is quite the rabbit-hole.)
      const generateEmbedding = req.body && typeof req.body.generateEmbedding === 'boolean'
        ? req.body.generateEmbedding
        : true

      // Check if profile exists
      const profile = await partnerDbService.profileByIssuerDid(profileDid)
      if (!profile) {
        // create an empty profile
        await partnerDbService.profileInsertOrUpdate({
          description: '',
          issuerDid: profileDid,
          locLat: null,
          locLon: null,
          locLat2: null,
          locLon2: null,
        })
      }

      // Update the flag
      const updated = await partnerDbService.profileUpdateGenerateEmbedding(profileDid, generateEmbedding)
      if (updated === 0) {
        return res.status(500).json({ error: "Profile could not be updated." }).end()
      }

      // Generate or remove embedding based on flag
      try {
        await ensureProfileEmbedding(profileDid)
      } catch (embErr) {
        console.error('Error updating profile embedding for DID:', profileDid, embErr)
        return res.status(500).json({ error: 'Profile updated but embedding generation failed. ' + embErr.message }).end()
      }

      res.status(200).json({ success: { generateEmbedding } }).end()
    } catch (err) {
      console.error('Error updating generateEmbedding flag for DID:', res.locals.authTokenIssuer, '... for params:', JSON.stringify({ profileDid, generateEmbedding }), err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Cut the bbox into sections, then return an array location + plan-counts for how many are located in that section with that location
 * Currently, this cuts the bbox into sections, anywhere from 4-8 tiles on side.
 *
 * Note that the report API has a similar endpoint /api/v2/report/planCountsByBBox
 * The front-end is simpler if the parameters and results are similar.
 *
 * @group partner utils
 * @route GET /api/partner/userProfileCountsByBBox
 * @param {string} minLocLat.query.required - minimum latitude in degrees of bounding box being searched
 * @param {string} maxLocLat.query.required - maximum latitude in degrees of bounding box being searched
 * @param {string} minLocLon.query.required - minimum longitude in degrees of bounding box being searched
 * @param {string} maxLocLon.query.required - maximum longitude in degrees of bounding box being searched
 * @returns {array.GridCounts} 200 - 'data' property with 'tiles' property with matching array of entries, each with a count of plans in that tile
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfileCountsByBBox',
  async (req, res) => {
    try {

      const minLocLat = Number.parseFloat(req.query.minLocLat)
      const maxLocLat = Number.parseFloat(req.query.maxLocLat)
      let minLocLon = Number.parseFloat(req.query.minLocLon)
      let maxLocLon = Number.parseFloat(req.query.maxLocLon)
      // allowing this old usage, replaced as of 4.2.0
      if (isNaN(minLocLon)) {
        minLocLon = Number.parseFloat(req.query.westLocLon)
      }
      if (isNaN(maxLocLon)) {
        maxLocLon = Number.parseFloat(req.query.eastLocLon)
      }

      if (isNaN(minLocLat) || isNaN(maxLocLat) || isNaN(minLocLon) || isNaN(maxLocLon)) {
        return res.status(400).json({ error: "Query parameters 'minLocLat', 'maxLocLat', 'minLocLon', and 'maxLocLon' must be numbers" }).end()
      }

      const tileWidth = latWidthToTileWidth(maxLocLat - minLocLat)
      // find the latitude that is a multiple of tileWidth and is closest to but below the minLocLat
      const minTileLat = Math.floor(minLocLat / tileWidth) * tileWidth
      // find the longitude that is a multiple of tileWidth and is closest to but west of the westLocLon
      const minTileLon = Math.floor(minLocLon / tileWidth) * tileWidth
      // find how many tiles wide the bounding box is
      const numTilesWide = Math.ceil((maxLocLon - minTileLon) / tileWidth)
      // calculate the maximum latitude & longitude with that many tiles
      const maxLatTiled = minTileLat + numTilesWide * tileWidth
      const maxLonTiled = minTileLon + numTilesWide * tileWidth
      const results1 = await partnerDbService.profileCountsByBBox(minLocLat, minLocLon, maxLatTiled, maxLonTiled, numTilesWide)
      const results2 = await partnerDbService.profileCountsByBBox(minLocLat, minLocLon, maxLatTiled, maxLonTiled, numTilesWide, true)

      // return an array of tiles
      // which only contains the first case of each set of index values
      // where tiles match if they have the same indexLat, indexLon, minFoundLat, minFoundLon, maxFoundLat, maxFoundLon
      // and which has a recordCount which is the sum of the recordCounts of the matching tiles

      const tiles = results1.concat(results2)

      const tilesWithBothCounts = mergeTileCounts(tiles)

      const result = {
        data: {
          tiles: tilesWithBothCounts.map(latLonFromTile(minLocLat, minLocLon, tileWidth)),
          minGridLat: minTileLat,
          minGridLon: minTileLon,
          tileWidth: tileWidth,
          numTilesWide: numTilesWide
        }
      }
      res.status(200).json(result).end()
    } catch (err) {
      let errorObj = err
      if ("" + err !== "[object Object]") {
        errorObj = "" + err // sometimes this gives more info
      }
      console.error('Error getting user profile counts by bbox:', err, '... for query params:', JSON.stringify(req.query))
      res.status(500).json({ error: errorObj }).end()
    }
  }
)

/**
 * Get nearest neighbors in the registration tree for a user profile
 *
 * @group partner utils
 * @route GET /api/partner/userProfileNearestNeighbors/{rowId}
 * @param {number} rowId.path.required - the profile ID to find neighbors for
 * @returns {array} 200 - success response with array of neighbors, each with "did" and "relation" properties
 * The relation is one of:
 * - "REGISTERED_BY_YOU" if the common ancestor is the source (target is in source's subtree)
 * - "REGISTERED_YOU" if the common ancestor is above the source (source needs to go up)
 * - "TARGET" if the source and target are the same
 * @returns {Error} 400 - client error
 * @returns {Error} 404 - profile not found
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfileNearestNeighbors/:rowId',
  async (req, res) => {
    const { rowId } = req.params
    try {
      const rowIdInt = parseInt(rowId)
      
      if (!res.locals.authTokenIssuer) {
        return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
      }
      
      // Get the profile to find the target DID
      const profile = await partnerDbService.profileById(rowIdInt)
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" }).end()
      }
      
      // Find nearest neighbors from requester to profile owner
      const neighbors = await nearestNeighborsTo(res.locals.authTokenIssuer, profile.issuerDid)
      
      res.status(200).json({ data: neighbors }).end()
    } catch (err) {
      console.error('Error getting nearest neighbors for user profile:', rowId, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)



/******************************************************
 * Group Onboarding
 ******************************************************/

/**
 * Create a new group onboarding room
 * 
 * @group partner utils
 * @route POST /api/partner/groupOnboard
 * @param {string} name.body.required - name of the room
 * @param {string} expiresAt.body.required - expiration time of the room (ISO string)
 * @param {string} content.body.required - personal content for the room creator
 * @param {string} projectLink.body.optional - URL to the project
 * @returns {object} 201 - Created with room ID
 * @returns {Error} 400 - client error
 */
.post(
  '/groupOnboard',
  async (req, res) => {
    try {
      // (When we separate this into another service, this will have to be an API call.
      // See the image-api server for an example of how to leverage JWTs to get
      // permission to access data from the other service.)
      await ClaimService.getRateLimits(res.locals.authTokenIssuer)
    } catch (e) {
      return res.status(400).json({ error: { userMessage: "You must have registration permissions to create a meeting." } }).end()
    }

    const { name, expiresAt, content, projectLink } = req.body
    
    // Validate inputs
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: { userMessage: "The meeting name must be non-empty text." } }).end()
    }

    const expireDate = new Date(expiresAt)
    if (isNaN(expireDate.getTime())) {
      return res.status(400).json({ error: { userMessage: "The expiration date is invalid." } }).end()
    }

    const maxExpireTime = new Date()
    maxExpireTime.setHours(maxExpireTime.getHours() + 24)
    if (expireDate > maxExpireTime) {
      return res.status(400).json({ error: { userMessage: "The expiration time cannot be more than 24 hours in the future." } }).end()
    }

    if (projectLink && typeof projectLink !== 'string') {
      return res.status(400).json({ error: { userMessage: "The project link must be a valid URL." } }).end()
    }

    try {
      const groupId = await partnerDbService.groupOnboardInsert(res.locals.authTokenIssuer, name, expiresAt, projectLink)
      const memberId = await partnerDbService.groupOnboardMemberInsert(res.locals.authTokenIssuer, groupId, content, true)
      res.status(201).json({ success: { groupId: groupId, memberId: memberId } }).end()
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        if (err.message.includes('issuerDid')) {
          return res.status(400).json({ error: { userMessage: "You already have an active meeting." } }).end()
        } else {
          return res.status(400).json({ error: { userMessage: "That meeting name is already taken." } }).end()
        }
      }
      console.error('Error creating meeting onboarding room for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get any groups set up by this person
 * 
 * @group partner utils
 * @route GET /api/partner/groupOnboard
 * @returns {object} 200 - the room they created with "groupId", "name", "expiresAt"
 */
.get(
  '/groupOnboard',
  async (req, res) => {
    try {
      // maybe undefined
      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (room && room.previousMatches) {
        room.previousMatches = JSON.parse(room.previousMatches)
      }
      res.status(200).json({ data: room }).end()
    } catch (err) {
      console.error('Error getting meeting onboarding room for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/** 
 * Get non-sensitive information about a group onboarding room by ID
 * 
 * @group partner utils
 * @route GET /api/partner/groupOnboard/{groupId}
 * @param {number} groupId.path.required - group ID
 * @returns {object} 200 - the room with "groupId", "name", "expiresAt" (but not other potentially sensitive information)
 */
.get(
  '/groupOnboard/:groupId',
  async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId)
      const room = await partnerDbService.groupOnboardGetByRowId(groupId)
      if (room && room.expiresAt && room.expiresAt < Date.now()) {
        return res.status(404).json({ error: { userMessage: "That meeting has expired." } }).end()
      }
      if (room) {
        // remove potentially sensitive data
        delete room.issuerDid
        delete room.previousMatches
      }
      res.status(200).json({ data: room }).end()
    } catch (err) {
      console.error('Error getting meeting onboarding room by ID:', req.params.groupId, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update a group onboarding room
 * 
 * @group partner utils
 * @route PUT /api/partner/groupOnboard
 * @param {string} name.body.optional - new room name
 * @param {string} expiresAt.body.optional - new room expiration date
 * @param {string} projectLink.body.optional - new project URL
 * @returns 200 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.put(
  '/groupOnboard',
  async (req, res) => {
    try {
      let { name, expiresAt, content, projectLink } = req.body

      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (!room) {
        return res.status(404).json({ error: { userMessage: "That meeting was not found for you." } }).end()
      }

      if (projectLink && typeof projectLink !== 'string') {
        return res.status(400).json({ error: { userMessage: "The project link must be a valid URL." } }).end()
      }

      const changes = await partnerDbService.groupOnboardUpdate(
        room.groupId,
        res.locals.authTokenIssuer,
        name || room.name,
        expiresAt || room.expiresAt,
        projectLink || room.projectLink
      )
      if (changes === 0) {
        return res.status(404).json({ error: { userMessage: "That meeting was not found to change." } }).end()
      }
      const result = { success: true }
      // update the member content
      if (content) {
        const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
        if (member) {
          const memberChanges = await partnerDbService.groupOnboardMemberUpdateContent(member.memberId, content)
          if (memberChanges === 0) {
            result.message = "Could not update your member content."
            console.error('User ' + res.locals.authTokenIssuer + ' has room ' + room.groupId + ' but somehow could not update their member record ' + member.memberId + ' with content.')
          }
        } else {
          result.message = "You were not found as a member of that group."
          console.error('User ' + res.locals.authTokenIssuer + ' has room ' + room.groupId + ' but somehow has no member record.')
        }
      } else {
        result.message = "Be sure to provide new 'content' if you change the meeting password."
      }
      res.status(200).json(result).end()
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: { userMessage: "That meeting name is already taken." } }).end()
      }
      console.error('Error updating meeting onboarding room for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Delete a group onboarding room
 *
 * @group partner utils
 * @route DELETE /api/partner/groupOnboard/{groupId}
 * @returns 204 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.delete(
  '/groupOnboard',
  async (req, res) => {
    try {
      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (!room) {
        return res.status(404).json({ error: { userMessage: "No meeting was found for you." } }).end()
      }
      const deleted = await partnerDbService.groupOnboardDeleteByRowAndIssuer(room.groupId, res.locals.authTokenIssuer)
      if (deleted === 0) {
        return res.status(404).json({ error: { userMessage: "That meeting couldn't be deleted." } }).end()
      }
      await partnerDbService.groupOnboardMemberDeleteByGroupId(room.groupId)
      res.status(204).json({ success: true }).end()
    } catch (err) {
      console.error('Error deleting meeting onboarding room for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Trigger semantic matching for a group (organizer only)
 * Pairs admitted members who have embeddings based on profile similarity.
 *
 * @group partner utils
 * @route POST /api/partner/groupOnboardMatch/{groupId}
 * @param {number} groupId.path.required - group ID
 * @param {string[]} excludedDids.body.optional - issuerDids to exclude from matching
 * @param {Array<[string, string]>} excludedPairDids.body.optional - pairs of issuerDids to never match
 * @param {Array<[string, string]>} previousPairDids.body.optional - pairs from previous rounds (don't repeat)
 * @returns {object} 200 - pairs with participants and similarity scores
 */
.post(
  '/groupOnboardMatch',
  async (req, res) => {
    try {
      // This is actually caught by the auth middleware, with 401 message "Missing Bearer JWT In Authorization header"
      if (!res.locals.authTokenIssuer) {
        return res.status(401).json({ error: "Request must include a valid Authorization JWT." }).end()
      }

      const group = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (!group) {
        return res.status(404).json({ error: { userMessage: "There is no meeting with you as the organizer." } }).end()
      }

      const { excludedDids = [], excludedPairDids = [], previousPairDids = [] } = req.body || {}

      const rows = await partnerDbService.groupMembersPlusEmbeddings(group.groupId)
      if (rows.length < 2) {
        return res.status(400).json({
          error: { userMessage: "Need at least 2 admitted members to match." },
        }).end()
      }

      const emptyEmbeddingStorage = embeddingToStorageString(EMBEDDING_FOR_EMPTY_STRING.data.empty.embedding)
      const rowsWithEmbeddings = rows.map((row) => ({
        ...row,
        embeddingVector: row.embeddingVector != null && String(row.embeddingVector).trim() !== ''
          ? row.embeddingVector
          : emptyEmbeddingStorage,
      }))
      const participants = buildParticipantsFromRows(rowsWithEmbeddings)
      const result = matchParticipants(participants, excludedDids, excludedPairDids, previousPairDids)

      // create lookup from issuerDid to content from rows
      const issuerDidToContent = new Map(rows.map((row) => [row.issuerDid, row.content]))

      const pairsForResponse = result.pairs.map((pair) => ({
        pairNumber: pair.pairNumber,
        similarity: pair.similarity,
        participants: pair.participants.map((p) => ({
          issuerDid: p.issuerDid,
          content: issuerDidToContent.get(p.issuerDid),
          description: p.description,
        })),
      }))

      await partnerDbService.groupOnboardUpdatePreviousMatches(group.groupId, JSON.stringify(pairsForResponse))

      res.status(200).json({ data: { pairs: pairsForResponse } }).end()
    } catch (err) {
      console.error('Error matching meeting members for body params:', JSON.stringify(req.body), '... with potential client message:', err)
      // the matchParticipants error messages are useful for the user
      res.status(400).json({ error: { userMessage: err.message } }).end()
    }
  }
)

/**
 * Get previous matching results for a group (anyone in the meeting)
 *
 * @group partner utils
 * @route GET /api/partner/groupOnboardMatch
 * @returns {object} 200 - previous pairs with participants and similarity scores, or null if none yet
 */
.get(
  '/groupOnboardMatch',
  async (req, res) => {
    try {
      // This is actually caught by the auth middleware, with 401 message "Missing Bearer JWT In Authorization header"
      if (!res.locals.authTokenIssuer) {
        return res.status(401).json({ error: "Meeting-onboard-match check must include valid authorization." }).end()
      }

      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
      if (!member) {
        return res.status(404).json({ error: "There is no meeting with you as a member." }).end()
      }
      const group = await partnerDbService.groupOnboardGetByRowId(member.groupId)
      if (!group) {
        return res.status(500).json({ error: "The server had a problem with this meeting. You'll need to start over. Report this to an admin with your details." }).end()
      }

      let pairs = null
      if (group.previousMatches) {
        try {
          pairs = JSON.parse(group.previousMatches)
        } catch (err) {
          console.error('Error parsing previous matches for group:', req.params.groupId, err)
          return res.status(500).json({ error: "The server had a problem with this meeting pairs. You'll need to start over. Report this to an admin with your details." }).end()
        }
      }
      res.status(200).json({ data: { pairs } }).end()
    } catch (err) {
      console.error('Error getting meeting previous matches for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/** Delete previous matches for a group (organizer only) */
.delete(
  '/groupOnboardMatch',
  async (req, res) => {
    try {
      const group = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (!group) {
        return res.status(404).json({ error: "There is no meeting with you as the organizer." }).end()
      }
      await partnerDbService.groupOnboardUpdatePreviousMatches(group.groupId, null)
      res.status(200).json({ success: true }).end()
    } catch (err) {
      console.error('Error deleting group previous matches for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get all group onboarding rooms
 *
 * @group partner utils
 * @route GET /api/partner/groupsOnboarding
 * @returns {array} 200 - List of rooms with "groupId", "name", "expiresAt"
 */
.get(
  '/groupsOnboarding',
  async (req, res) => {
    try {
      const rooms = await partnerDbService.groupOnboardGetAllActive()
      res.status(200).json({ data: rooms }).end()
    } catch (err) {
      console.error('Error getting all meeting onboarding rooms:', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)






/******************************************************
 * Group Onboarding Members
 ******************************************************/

/**
 * Join a group onboarding room
 * 
 * @group partner utils
 * @route POST /api/partner/groupOnboardMember
 * @param {number} groupId.body.required - group ID to join
 * @param {string} content.body.required - member content
 * @returns {object} 201 - Created
 * @returns {Error} 400 - client error
 */
.post(
  '/groupOnboardMember',
  async (req, res) => {
    const { groupId, content } = req.body
    try {

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: { userMessage: "The content must be non-empty text." } }).end()
      }

      // Verify group exists
      const group = await partnerDbService.groupOnboardGetByRowId(groupId)
      if (!group) {
        return res.status(404).json({ error: { userMessage: "That group was not found." } }).end()
      }
      if (group.expiresAt && group.expiresAt < Date.now()) {
        return res.status(404).json({ error: { userMessage: "That meeting has expired." } }).end()
      }

      try {
        const memberId = await partnerDbService.groupOnboardMemberInsert(res.locals.authTokenIssuer, groupId, content)
        res.status(201).json({ success: { memberId: memberId } }).end()
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          // retrieve the member record and continue
          // (This makes the POST idempotent. We could probably combine this with PUT funcationality.)
          // (Then again, one wonders if this whole idempotent quality here is a good idea or not.)
          const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
          if (member) {
            // check that the group is the same
            if (member.groupId !== groupId) {
              return res.status(400).json({ error: { userMessage: "You already exist in a different group." } }).end()
            }
            // update their content if they sent something new
            const memberChanges = await partnerDbService.groupOnboardMemberUpdateContent(member.memberId, content)
            if (memberChanges === 0) {
              return res.status(400).json({ error: { userMessage: "You already exist in this group but your content could not be updated." } }).end()
            } else {
              return res.status(200).json({ success: { memberId: member.memberId } }).end()
            }
          } else {
            // may be a client error but I'm really not sure
            return res.status(400).json({ error: err.message }).end()
          }
        }
        throw err
      }
    } catch (err) {
      console.error('Error joining group onboarding room for DID:', res.locals.authTokenIssuer, '... for group:', groupId, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get current user's group membership
 * 
 * @group partner utils
 * @route GET /api/partner/groupOnboardMember
 * @returns {object} 200 - Member record with groupId, content, and admitted status, or undefined if not in a group
 * @returns {Error} 500 - server error
 */
.get(
  '/groupOnboardMember',
  async (req, res) => {
    try {
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
      res.status(200).json({ data: member }).end()
    } catch (err) {
      console.error('Error getting group membership for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get group members for the group the member is in
 * 
 * @group partner utils
 * @route GET /api/partner/groupOnboardMembers/{groupId}
 * @returns {array} 200 - List of members with "issuerDid", "content", "admitted"
 * @returns {Error} 403 - Unauthorized
 */
.get(
  '/groupOnboardMembers',
  async (req, res) => {
    try {
      // get group member is in
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
      if (!member) {
        return res.status(404).json({ error: { userMessage: "You are not found in any group." } }).end()
      }

      const group = await partnerDbService.groupOnboardGetByRowId(member.groupId)
      if (!group) {
        return res.status(404).json({ error: { userMessage: "That is not a valid group." } }).end()
      }

      const members = await partnerDbService.groupOnboardMembersGetByGroup(member.groupId)

      const isOrganizer = group.issuerDid === res.locals.authTokenIssuer

      if (isOrganizer) {
        // Return everyone with acceptable properties
        const allMembers = members
          .map(m => ({
            admitted: m.admitted,
            memberId: m.memberId,
            content: m.content,
          }))
        return res.status(200).json({ data: allMembers }).end()
      }

      // Find requesting user's membership
      const requesterMember = members.find(m => m.issuerDid === res.locals.authTokenIssuer)
      if (!requesterMember) {
        return res.status(403).json({ error: { userMessage: "You have not joined this group." } }).end()
      }
      if (!requesterMember.admitted) {
        const organizer = members[0]
        const result = [
          {
            memberId: organizer.memberId,
            content: organizer.content
          }
        ]
        return res.status(200).json({ data: result }).end()
      }

      // Return only admitted members
      const admittedMembers = members
        .filter(m => m.admitted)
        .map(m => ({
          memberId: m.memberId,
          content: m.content
        }))

      res.status(200).json({ data: admittedMembers }).end()
    } catch (err) {
      console.error('Error getting group members for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update group membership for token issuer
 *
 * @group partner utils
 * @route PUT /api/partner/groupOnboardMember/{groupId}
 * @param {number} memberId.path.required - group ID
 * @param {string} content.body.optional - new content
 * @returns 200 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.put(
  '/groupOnboardMember',
  async (req, res) => {
    try {
      // get member record
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.authTokenIssuer)
      await updateGroupMember(member.memberId, member, req.body, res)
    } catch (err) {
      console.error('Error updating group membership for token issuer:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update group membership for given member (by the organizer)
 * 
 * @group partner utils
 * @route PUT /api/partner/groupOnboardMember/{groupId}
 * @param {number} memberId.path.required - group ID
 * @param {string} content.body.optional - new content
 * @param {boolean} admitted.body.optional - admission status (organizer only)
 * @returns 200 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.put(
  '/groupOnboardMember/:memberId',
  async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId)

      // get member record
      const member = await partnerDbService.groupOnboardMemberGetByRowId(memberId)
      await updateGroupMember(memberId, member, req.body, res)
    } catch (err) {
      console.error('Error updating group membership for given member:', req.params.memberId, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Leave a group
 * 
 * @group partner utils
 * @route DELETE /api/partner/groupOnboardMember/{groupId}
 * @param {number} groupId.path.required - group ID to leave
 * @returns 204 - Success
 * @returns {Error} 404 - Not found
 */
.delete(
  '/groupOnboardMember',
  async (req, res) => {
    try {
      // first check that they are not the organizer of a meeting
      const group = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.authTokenIssuer)
      if (group) {
        return res.status(403).json({ error: { userMessage: "You are the organizer of a group. You can only leave the group by deleting it." } }).end()
      }

      const deleted = await partnerDbService.groupOnboardMemberDelete(res.locals.authTokenIssuer)
      if (deleted === 0) {
        return res.status(404).json({ error: { userMessage: "That membership was not found." } }).end()
      }
      res.status(204).end()
    } catch (err) {
      console.error('Error leaving group for DID:', res.locals.authTokenIssuer, err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)
