/**
 * See partner-link.service.js for an explanation why these endpoints are kept separate.
 */

import * as R from 'ramda'
import * as express from 'express'
import { sendAndStoreLink } from "../services/partner-link.service";
import { dbService } from "../services/endorser.db.service";
import { getAllDidsBetweenRequesterAndObjects } from "../services/network-cache.service";
import { HIDDEN_TEXT } from '../services/util';

export default express
.Router()
.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
})

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

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
    // this will check if the issuer actually created the JWT, so no need to check registration limits
    const result =
      await sendAndStoreLink(
        res.locals.tokenIssuer,
        req.body.jwtId,
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
      res.status(201).json({ success: result }).end()
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
.post(
  '/user-profile',
  async (req, res) => {
    const { description, locLat, locLon, locLat2, locLon2 } = req.body
    
    // Validate inputs
    if (!description || typeof description !== 'string') {
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

      // delete so that we can use the "id" field for pagination
      // so that users can see updated profiles at the top of their list
      await dbService.profileDelete(entry.issuerDid)
      
      await dbService.profileInsert(entry)

      res.status(201).json({ success: true }).end()
    } catch (err) {
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get profiles by location or text search
 * @group partner utils - Partner Utils
 * @route GET /api/partner/user-profile
 * @param {number} minLat.query.optional - minimum latitude coordinate
 * @param {number} minLon.query.optional - minimum longitude coordinate
 * @param {number} maxLat.query.optional - maximum latitude coordinate
 * @param {number} maxLon.query.optional - maximum longitude coordinate
 * @param {string} claimContents.query.optional - text to search in description
 * @param {string} beforeId.query.optional - return profiles with id less than this
 * @param {string} afterId.query.optional - return profiles with id greater than this
 * @returns {Object} 200 - success response with profiles
 * @returns {Error} 400 - client error
 */
.get(
  '/user-profile',
  async (req, res) => {
    const { minLat, minLon, maxLat, maxLon, claimContents, beforeId, afterId } = req.query

    const numMinLat = minLat ? Number(minLat) : null
    const numMinLon = minLon ? Number(minLon) : null
    const numMaxLat = maxLat ? Number(maxLat) : null
    const numMaxLon = maxLon ? Number(maxLon) : null

    if (minLat && (isNaN(numMinLat) || numMinLat < -90 || numMinLat > 90)) {
      return res.status(400).json({ error: "Query parameter 'minLat' must be a number between -90 and 90" }).end()
    }
    if (minLon && (isNaN(numMinLon) || numMinLon < -180 || numMinLon > 180)) {
      return res.status(400).json({ error: "Query parameter 'minLon' must be a number between -180 and 180" }).end()
    }
    if (maxLat && (isNaN(numMaxLat) || numMaxLat < -90 || numMaxLat > 90)) {
      return res.status(400).json({ error: "Query parameter 'maxLat' must be a number between -90 and 90" }).end()
    }
    if (maxLon && (isNaN(numMaxLon) || numMaxLon < -180 || numMaxLon > 180)) {
      return res.status(400).json({ error: "Query parameter 'maxLon' must be a number between -180 and 180" }).end()
    }

    try {
      const rawResult = await dbService.profilesByLocation(
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
      // If we separate partner functions to a different service, we'll have to create an endpoint for this.
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
      res.json(fullResult).end()
    } catch (err) {
      res.status(500).json({ error: err.message }).end()
    }
  }
)
