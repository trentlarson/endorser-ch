import * as express from 'express'
import * as R from 'ramda'

import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

import DbService from '../services/endorser.db.service';
class DbController {

  getAllJwtsPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    DbService.jwtsByParamsPaged(query, afterId, beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { req.resultJsonWrap = results; next(); })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getAllIssuerClaimTypesPaged(req, res, next) {
    const claimTypes = JSON.parse(req.query.claimTypes)
    if (!Array.isArray(claimTypes)) {
      return res.status(400).json({error: "Parameter 'claimTypes' should be an array but got: " + req.query.claimTypes}).end()
    }
    DbService.allIssuerClaimTypesPaged(res.locals.tokenIssuer, claimTypes, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { req.resultJsonWrap = results; next(); })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getCanClaim(req, res) {
    DbService.registrationByDid(res.locals.tokenIssuer)
      .then(r => {
        const dataResult = { data: !!r }
        if (!r) {
          dataResult.error = "The person who referred you can register you."
        }
        return res.json(dataResult).end()
      })
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }

}
let dbController = new DbController();

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
 * @typedef Jwt
 * @property {string} id
 * @property {datetime} issuedAt
 * @property {string} issuer
 * @property {string} subject
 * @property {string} claimContext
 * @property {string} claimType
 * @property {object} claim
 * @property {string} hashHex
 * @property {string} hashChainHex
 */

/**
 * @typedef JwtArrayMaybeMoreBody
 * @property {Array.Jwt} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * Check if current user can create a claim.
 *
 * @route GET /api/report/canClaim
 * @returns {Object} data boolean property tells whether this user is allowed to create a claim
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canClaim', dbController.getCanClaim)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string), paginated, reverse-chronologically
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/reportAll/claims
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {JwtArrayMaybeMoreBody} 200 - matching claims, reverse-chronologically
 * @returns {Error}  default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claims', dbController.getAllJwtsPaged)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/reportAll/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @returns {JwtArrayMaybeMoreBody} 200 - claims issued by this user with any of those claim types, reverse-chronologically
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypesPaged)
