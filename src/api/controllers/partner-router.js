/**
 * See partner-link.service.js for an explanation why these endpoints are kept separate.
 */

import * as R from 'ramda'
import * as express from 'express'
import ClaimService from '../services/claim.service'
import { sendAndStoreLink } from "../services/partner-link.service";
import { endorserDbService } from "../services/endorser.db.service";
import { dbService } from "../services/partner.db.service";
import { getAllDidsBetweenRequesterAndObjects } from "../services/network-cache.service";
import {HIDDEN_TEXT, latLonFromTile, latWidthToTileWidth} from '../services/util';

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
 * @property {number} minLat - minimum latitude of this bucket
 * @property {number} minLon - minimum longitude of this bucket
 * @property {number} minFoundLat - lowest latitude of matches found in this bucket
 * @property {number} minFoundLon - westernmost longitude of matches found in this bucket
 * @property {number} maxFoundLat - highest latitude of matches found in this bucket
 * @property {number} maxFoundLon - easternmost longitude of matches found in this bucket
 * @property {number} recordCount - number of records found in this bucket
 */

// similar code is in report-router.js
/**
 * @typedef GridCounts
 * @property {array.LocationCount} tiles - counts of records in each tile of the grid
 * @property {number} minLat - minimum latitude of the searched area (which may be outside the bounding box)
 * @property {number} minLon - minimum longitude of the searched area (which may be outside the bounding box)
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
 * @property {string} rowid - the profile ID
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
      let result = await dbService.profileByIssuerDid(issuerDid)

      if (!result) {
        return res.status(404).json({ error: "Profile not found" }).end()
      }
      if (issuerDid !== res.locals.tokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
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
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get a user's profile by ID
 *
 * @group partner utils - Partner Utils
 * @route GET /api/partner/userProfile/{id}
 * @param {string} rowid.path.required - the profile ID to retrieve
 * @returns {UserProfile} 200 - success response with profile
 * @returns {Error} 403 - unauthorized
 * @returns {Error} 404 - not found
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfile/:rowid',
  async (req, res) => {
    const { rowid } = req.params
    try {
      let result = await dbService.profileById(rowid)

      if (!result) {
        return res.status(404).json({ error: "Profile not found" }).end()
      }

      if (result.issuerDid !== res.locals.tokenIssuer) {
        // check if they can see the profile, or if they're linked to someone who can
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
      res.status(500).json({ error: err.message }).end()
    }
  }
)

/**
 * Get profiles by location or text search
 *
 * @group partner utils - Partner Utils
 * @route GET /api/partner/userProfile
 * @param {number} minLat.query.optional - minimum latitude coordinate
 * @param {number} minLon.query.optional - minimum longitude coordinate
 * @param {number} maxLat.query.optional - maximum latitude coordinate
 * @param {number} maxLon.query.optional - maximum longitude coordinate
 * @param {string} claimContents.query.optional - text to search in description
 * @param {string} beforeId.query.optional - return profiles with rowid less than this
 * @param {string} afterId.query.optional - return profiles with rowid greater than this
 * @returns {array.UserProfile} 200 - success response with profiles
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get(
  '/userProfile',
  async (req, res) => {
    const { minLat, minLon, maxLat, maxLon, claimContents, beforeId, afterId } = req.query

    const numMinLat = minLat ? Number(minLat) : null
    const numMinLon = minLon ? Number(minLon) : null
    const numMaxLat = maxLat ? Number(maxLat) : null
    const numMaxLon = maxLon ? Number(maxLon) : null

    if (!res.locals.tokenIssuer) {
      return res.status(400).json({ error: "Request must include a valid Authorization JWT" }).end()
    }
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
      // This doesn't use the same "hide" functions built into other services because we expect to split this out someday.
      // When we separate partner functions to a different service, we'll have to create an endpoint for this.
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
      const result = await dbService.profileDelete(res.locals.tokenIssuer)
      res.status(204).json({ success: true, numDeleted: result }).end()
    } catch (err) {
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
 * @param {string} minLat.query.required - minimum latitude in degrees of bounding box being searched
 * @param {string} maxLat.query.required - maximum latitude in degrees of bounding box being searched
 * @param {string} minLon.query.required - minimum longitude in degrees of bounding box being searched
 * @param {string} maxLon.query.required - maximum longitude in degrees of bounding box being searched
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
      const minLatTile = Math.floor(minLocLat / tileWidth) * tileWidth
      // find the longitude that is a multiple of tileWidth and is closest to but west of the westLocLon
      const minLonTile = Math.floor(minLocLon / tileWidth) * tileWidth
      // find how many tiles wide the bounding box is
      const numTilesWide = Math.ceil((maxLocLon - minLonTile) / tileWidth)
      // calculate the maximum latitude with that many tiles
      const maxLatTiled = minLatTile + numTilesWide * tileWidth
      // calculate the maximum longitude with that many tiles
      const maxLonTiled = minLonTile + numTilesWide * tileWidth
      const results1 = await dbService.profileCountsByBBox(minLocLat, minLocLon, maxLatTiled, maxLonTiled, numTilesWide)
      const results2 = await dbService.profileCountsByBBox(minLocLat, minLocLon, maxLatTiled, maxLonTiled, numTilesWide, true)

      // return an array of tiles
      // which only contains the first case of each set of index values
      // where tiles match if they have the same indexLat, indexLon, minFoundLat, minFoundLon, maxFoundLat, maxFoundLon
      // and which has a recordCount which is the sum of the recordCounts of the matching tiles

      const tiles = results1.concat(results2)

      // find the first and last index of each tile

      // use this function that uniquely identifies a tile
      const tilesMatch = (tile1, tile2) =>
        tile1.indexLat === tile2.indexLat &&
        tile1.indexLon === tile2.indexLon &&
        tile1.minFoundLat === tile2.minFoundLat &&
        tile1.minFoundLon === tile2.minFoundLon &&
        tile1.maxFoundLat === tile2.maxFoundLat &&
        tile1.maxFoundLon === tile2.maxFoundLon
      const uniqueTiles = tiles.filter((tile, index, self) =>
        index === self.findIndex(t => tilesMatch(t, tile))
      )
      const firstTileIndex = uniqueTiles.map((tile, index, self) =>
        tiles.findIndex(t => tilesMatch(t, tile))
      )
      const lastTileIndex = uniqueTiles.map((tile, index, self) =>
        tiles.findLastIndex(t => tilesMatch(t, tile))
      )
      // now get the recordCount from the first one
      const tilesWithBothCounts = uniqueTiles.map((tile, index) => {
        let tileCount = tile.recordCount
        if (lastTileIndex[index] !== firstTileIndex[index]) {
          // there is more that came from lat2 & lon2 in some profile
          tileCount += tiles[lastTileIndex[index]].recordCount
        }
        const newTile = {
          ...tile,
          recordCount: tileCount
        }
        return newTile
      })

      const result = {
        data: {
          tiles: tilesWithBothCounts.map(latLonFromTile(minLocLat, minLocLon, tileWidth)),
          minLat: minLocLat,
          minLon: minLocLon,
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
      res.status(500).json({ error: errorObj }).end()
    }
  }
)
