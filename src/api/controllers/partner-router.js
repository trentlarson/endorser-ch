/**
 * See partner-link.service.js for an explanation why these endpoints are kept separate.
 */

import * as R from 'ramda'
import * as express from 'express'
import ClaimService from '../services/claim.service'
import { sendAndStoreLink } from "../services/partner-link.service";
import { dbService as endorserDbService } from "../services/endorser.db.service";
import { dbService as partnerDbService } from "../services/partner.db.service";
import { getAllDidsBetweenRequesterAndObjects } from "../services/network-cache.service";
import {HIDDEN_TEXT, latLonFromTile, latWidthToTileWidth, mergeTileCounts} from '../services/util';

/**
 * Update membership details for given member
 *
 * @param {number} memberId - member ID
 * @param {object} member - member record
 * @param {string} content - new content
 * @param {boolean} admitted - admission status (organizer only)
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

  const isMember = res.locals.tokenIssuer === member.issuerDid
  const isOrganizer = res.locals.tokenIssuer === group.issuerDid

  if (!isMember && !isOrganizer) {
    return res.status(403).json({ error: "You are not authorized to update this member." }).end()
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
    if (memberId === res.locals.tokenIssuer) {
      // organizer cannot revoke their own admission
      return res.status(403).json({ error: "As organizer, you cannot revoke your own admission." }).end()
    }
    const updated = await partnerDbService.groupOnboardMemberUpdateAdmitted(memberId, bodyData.admitted)
    if (updated === 0) {
      return res.status(404).json({ error: "That member ID could not be updated with admission status." }).end()
    }
    if (bodyData.content) {
      result.message = "Only the member can update their content."
    }
  }

  result.success = true
  return res.status(200).json(result).end()
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
 */

/**
 * Add a link to some partner service
 *
 * @group partner utils - Partner Utils
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

      const result =
        await sendAndStoreLink(
          res.locals.tokenIssuer,
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
      console.error('Error adding partner link', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Add a profile for a user
 *
 * @group partner utils - Partner Utils
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
      await ClaimService.getRateLimits(res.locals.tokenIssuer)
    } catch (e) {
      // must not have an account
      return res.status(400).json({ error: "Must be registered to submit a profile" }).end()
    }

    // Validate inputs
    if (!res.locals.tokenIssuer) {
      return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
    }
    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: "Query parameter 'description' must be a non-empty string" }).end()
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
        issuerDid: res.locals.tokenIssuer,
        description,
        locLat,
        locLon,
        locLat2,
        locLon2
      }

      await partnerDbService.profileInsertOrUpdate(entry)

      res.status(201).json({ success: true }).end()
    } catch (err) {
      console.error('Error adding user profile', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)


/**
 * Get a user's profile
 *
 * @group partner utils - Partner Utils
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

      if (!result) {
        return res.status(404).json({ error: "Profile not found" }).end()
      }
      if (issuerDid !== res.locals.tokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
        // (When we separate this into another service, this will have to be an API call.
        // See the image-api server for an example of how to leverage JWTs to get
        // permission to access data from the other service.)
        const didsSeenByRequesterWhoSeeObject =
          await getAllDidsBetweenRequesterAndObjects(res.locals.tokenIssuer, [issuerDid])
        if (didsSeenByRequesterWhoSeeObject[0] === issuerDid) {
          // the issuerDid is visible to the requester, so continue with full content
        } else {
          // someone the issuer can see can see the profile,
          // but giving up all between would expose their full network
          return res.status(403).json({ error: "Profile not visible" }).end()
        }
      }
      res.status(200).json({ data: result }).end()
    } catch (err) {
      console.error('Error getting user profile for issuer', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get a user's profile by ID
 *
 * @group partner utils - Partner Utils
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

      if (result.issuerDid !== res.locals.tokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
        // (When we separate this into another service, this will have to be an API call.
        // See the image-api server for an example of how to leverage JWTs to get
        // permission to access data from the other service.)
        const didsSeenByRequesterWhoSeeObject =
          await getAllDidsBetweenRequesterAndObjects(res.locals.tokenIssuer, [result.issuerDid])
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
      res.status(200).json({ data: result }).end()
    } catch (err) {
      console.error('Error getting user profile by ID', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get profiles by location or text search
 *
 * @group partner utils - Partner Utils
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
    try {
      const { minLocLat, minLocLon, maxLocLat, maxLocLon, claimContents, beforeId, afterId } = req.query

      const numMinLat = minLocLat ? Number(minLocLat) : null
      const numMinLon = minLocLon ? Number(minLocLon) : null
      const numMaxLat = maxLocLat ? Number(maxLocLat) : null
      const numMaxLon = maxLocLon ? Number(maxLocLon) : null

      if (!res.locals.tokenIssuer) {
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
        await getAllDidsBetweenRequesterAndObjects(res.locals.tokenIssuer, resultList.map(profile => profile.issuerDid))
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
      console.error('Error getting user profile', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Delete a user's profile
 *
 * @group partner utils - Partner Utils
 * @route DELETE /api/partner/userProfile
 * @returns 200 - success response with number of deleted profiles
 * @returns {Error} 500 - server error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.delete(
  '/userProfile',
  async (req, res) => {
    try {
      if (!res.locals.tokenIssuer) {
        return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
      }
      const result = await partnerDbService.profileDelete(res.locals.tokenIssuer)
      res.status(204).json({ success: { numDeleted: result } }).end()
    } catch (err) {
      console.error('Error deleting user profile', err)
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
 * @group partner utils - Partner Utils
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
      console.error('Error getting user profile counts by bbox', err)
      res.status(500).json({ error: errorObj }).end()
    }
  }
)

/**
 * Create a new group onboarding room
 * 
 * @group partner utils - Partner Utils
 * @route POST /api/partner/groupOnboard
 * @param {string} name.body.required - name of the room
 * @param {string} expiresAt.body.required - expiration time of the room (ISO string)
 * @param {string} content.body.required - personal content for the room creator
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
      await ClaimService.getRateLimits(res.locals.tokenIssuer)
    } catch (e) {
      return res.status(400).json({ error: { message: "You must have registration permissions to create a group." } }).end()
    }

    const { name, expiresAt, content } = req.body
    
    // Validate inputs
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: { message: "The group name must be non-empty text." } }).end()
    }

    const expireDate = new Date(expiresAt)
    if (isNaN(expireDate.getTime())) {
      return res.status(400).json({ error: { message: "The expiration date is invalid." } }).end()
    }

    const maxExpireTime = new Date()
    maxExpireTime.setHours(maxExpireTime.getHours() + 24)
    if (expireDate > maxExpireTime) {
      return res.status(400).json({ error: { message: "The expiration time cannot be more than 24 hours in the future." } }).end()
    }

    try {
      const groupId = await partnerDbService.groupOnboardInsert(res.locals.tokenIssuer, name, expiresAt)
      const memberId = await partnerDbService.groupOnboardMemberInsert(res.locals.tokenIssuer, groupId, content, true)
      res.status(201).json({ success: { groupId: groupId, memberId: memberId } }).end()
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        if (err.message.includes('issuerDid')) {
          return res.status(400).json({ error: { message: "You already have an active group." } }).end()
        } else {
          return res.status(400).json({ error: { message: "That group name is already taken." } }).end()
        }
      }
      console.error('Error creating group onboarding room', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get any groups set up by this person
 * 
 * @group partner utils - Partner Utils
 * @route GET /api/partner/groupOnboard
 * @returns {object} 200 - the room they created with "groupId", "name", "expiresAt"
 */
.get(
  '/groupOnboard',
  async (req, res) => {
    try {
      // maybe undefined
      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.tokenIssuer)
      res.status(200).json({ data: room }).end()
    } catch (err) {
      console.error('Error getting group onboarding room', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/** 
 * Get a group onboarding room by ID
 * 
 * @group partner utils - Partner Utils
 * @route GET /api/partner/groupOnboard/{groupId}
 * @param {number} groupId.path.required - group ID
 * @returns {object} 200 - the room with "groupId", "name", "expiresAt"
 */
.get(
  '/groupOnboard/:groupId',
  async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId)
      const room = await partnerDbService.groupOnboardGetByRowId(groupId)
      res.status(200).json({ data: room }).end()
    } catch (err) {
      console.error('Error getting group onboarding room by ID', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get all group onboarding rooms
 *
 * @group partner utils - Partner Utils
 * @route GET /api/partner/groupsOnboarding
 * @returns {array} 200 - List of rooms with "groupId", "name", "expiresAt"
 */
.get(
  '/groupsOnboarding',
  async (req, res) => {
    try {
      const rooms = await partnerDbService.groupOnboardGetAll()
      res.status(200).json({ data: rooms }).end()
    } catch (err) {
      console.error('Error getting all group onboarding rooms', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update a group onboarding room
 * 
 * @group partner utils - Partner Utils
 * @route PUT /api/partner/groupOnboard
 * @param {string} name.body.optional - new room name
 * @param {string} expiresAt.body.optional - new room expiration date
 * @returns 200 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.put(
  '/groupOnboard',
  async (req, res) => {
    try {
      let { name, expiresAt, content } = req.body

      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.tokenIssuer)
      if (!room) {
        return res.status(404).json({ error: { message: "That group was not found for you." } }).end()
      }

      const changes = await partnerDbService.groupOnboardUpdate(
        room.groupId,
        res.locals.tokenIssuer,
        name || room.name,
        expiresAt || room.expiresAt,
      )
      if (changes === 0) {
        return res.status(404).json({ error: { message: "That group was not found to change." } }).end()
      }
      const result = { success: true }
      // update the member content
      if (content) {
        const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.tokenIssuer)
        if (member) {
          const memberChanges = await partnerDbService.groupOnboardMemberUpdateContent(member.memberId, content)
          if (memberChanges === 0) {
            result.message = "Could not update your member content."
            console.error('User ' + res.locals.tokenIssuer + ' has room ' + room.groupId + ' but somehow could not update their member record ' + member.memberId + ' with content.')
          }
        } else {
          result.message = "You were not found as a member of that group."
          console.error('User ' + res.locals.tokenIssuer + ' has room ' + room.groupId + ' but somehow has no member record.')
        }
      } else {
        result.message = "Be sure to provide new 'content' if you change the group password."
      }
      res.status(200).json(result).end()
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: { message: "That group name is already taken." } }).end()
      }
      console.error('Error updating group onboarding room', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Delete a group onboarding room
 *
 * @group partner utils - Partner Utils
 * @route DELETE /api/partner/groupOnboard/{groupId}
 * @returns 204 - Success
 * @returns {Error} 403 - Unauthorized
 * @returns {Error} 404 - Not found
 */
.delete(
  '/groupOnboard',
  async (req, res) => {
    try {
      const room = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.tokenIssuer)
      if (!room) {
        return res.status(404).json({ error: { message: "No group was found for you." } }).end()
      }
      const deleted = await partnerDbService.groupOnboardDeleteByRowAndIssuer(room.groupId, res.locals.tokenIssuer)
      if (deleted === 0) {
        return res.status(404).json({ error: { message: "That group couldn't be deleted." } }).end()
      }
      await partnerDbService.groupOnboardMemberDeleteByGroupId(room.groupId)
      res.status(204).json({ success: true }).end()
    } catch (err) {
      console.error('Error deleting group onboarding room', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Join a group onboarding room
 * 
 * @group partner utils - Partner Utils
 * @route POST /api/partner/groupOnboardMember
 * @param {number} groupId.body.required - group ID to join
 * @param {string} content.body.required - member content
 * @returns {object} 201 - Created
 * @returns {Error} 400 - client error
 */
.post(
  '/groupOnboardMember',
  async (req, res) => {
    try {
      const { groupId, content } = req.body

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: { message: "The content must be non-empty text." } }).end()
      }

      // Verify group exists
      const group = await partnerDbService.groupOnboardGetByRowId(groupId)
      if (!group) {
        return res.status(404).json({ error: { message: "That group was not found." } }).end()
      }

      try {
        const memberId = await partnerDbService.groupOnboardMemberInsert(res.locals.tokenIssuer, groupId, content)
        res.status(201).json({ success: { memberId: memberId } }).end()
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          // retrieve the member record and succeed
          const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.tokenIssuer)
          if (member) {
            return res.status(200).json({ success: { memberId: member.memberId } }).end()
          } else {
            return res.status(400).json({ error: err.message }).end()
          }
        }
        throw err
      }
    } catch (err) {
      console.error('Error joining group onboarding room', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get current user's group membership
 * 
 * @group partner utils - Partner Utils
 * @route GET /api/partner/groupOnboardMember
 * @returns {object} 200 - Member record with groupId, content, and admitted status, or undefined if not in a group
 * @returns {Error} 500 - server error
 */
.get(
  '/groupOnboardMember',
  async (req, res) => {
    try {
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.tokenIssuer)
      res.status(200).json({ data: member }).end()
    } catch (err) {
      console.error('Error getting group membership', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get group members for the group the member is in
 * 
 * @group partner utils - Partner Utils
 * @route GET /api/partner/groupOnboardMembers/{groupId}
 * @returns {array} 200 - List of members with "issuerDid", "content", "admitted"
 * @returns {Error} 403 - Unauthorized
 */
.get(
  '/groupOnboardMembers',
  async (req, res) => {
    try {
      // get group member is in
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.tokenIssuer)
      if (!member) {
        return res.status(404).json({ error: { message: "You are not found in any group." } }).end()
      }

      const group = await partnerDbService.groupOnboardGetByRowId(member.groupId)
      if (!group) {
        return res.status(404).json({ error: { message: "That is not a valid group." } }).end()
      }

      const members = await partnerDbService.groupOnboardMembersGetByGroup(member.groupId)

      const isOrganizer = group.issuerDid === res.locals.tokenIssuer

      if (isOrganizer) {
        // Organizer sees everything
        return res.status(200).json({ data: members }).end()
      }

      // Find requesting user's membership
      const requesterMember = members.find(m => m.issuerDid === res.locals.tokenIssuer)
      if (!requesterMember) {
        return res.status(403).json({ error: { message: "You have not joined this group." } }).end()
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
      console.error('Error getting group members', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update group membership for token issuer
 *
 * @group partner utils - Partner Utils
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
      const member = await partnerDbService.groupOnboardMemberGetByIssuerDid(res.locals.tokenIssuer)
      await updateGroupMember(member.memberId, member, req.body, res)
    } catch (err) {
      console.error('Error updating group membership for token issuer', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Update group membership for given member (by the organizer)
 * 
 * @group partner utils - Partner Utils
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
      console.error('Error updating group membership for given member', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Leave a group
 * 
 * @group partner utils - Partner Utils
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
      const group = await partnerDbService.groupOnboardGetByIssuerDid(res.locals.tokenIssuer)
      if (group) {
        return res.status(403).json({ error: { message: "You are the organizer of a group. You can only leave the group by deleting it." } }).end()
      }

      const deleted = await partnerDbService.groupOnboardMemberDelete(res.locals.tokenIssuer)
      if (deleted === 0) {
        return res.status(404).json({ error: "That membership was not found." }).end()
      }
      res.status(204).end()
    } catch (err) {
      console.error('Error leaving group', err)
      res.status(500).json({ error: err.message }).end()
    }
  }
)
