import * as express from 'express'
import * as R from 'ramda'

import { UPORT_PUSH_TOKEN_HEADER } from '../services/util'
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
      .catch(err => { res.status(500).json(""+err).end() })
  }

  getAllIssuerClaimTypesPaged(req, res, next) {
    const claimTypes = JSON.parse(req.query.claimTypes)
    if (!Array.isArray(claimTypes)) {
      return res.status(400).json({error: "Parameter 'claimTypes' should be an array but got: " + req.query.claimTypes}).end()
    }
    DbService.allIssuerClaimTypesPaged(res.locals.tokenIssuer, claimTypes, req.query.afterId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        maybeMoreAfter: results.hitLimit && results.data[results.data.length - 1].id, // legacy API; can be removed when people are on mobile v 6.3.100+
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { req.resultJsonWrap = results; next(); })
      .catch(err => { res.status(500).json(""+err).end() })
  }

}
let dbController = new DbController();

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, ' + UPORT_PUSH_TOKEN_HEADER);
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
 * @property {string} maybeMoreBefore is the string before which to start searching on next request
 * @property {string} maybeMoreAfter is the string after which to start searching on next request
 */

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/reportAll/claims
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive), for pagination
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive), for pagination; will order results reverse chronologically; start at end with value of 'ZZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {JwtArrayMaybeMoreBody} 200 - matching claims
 * @returns {Error}  default - Unexpected error
 */
  .get('/claims', dbController.getAllJwtsPaged)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/reportAll/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive), for pagination
 * @returns {JwtArrayMaybeMoreBody} 200 - claims issued by this user with any of those claim types
 * @returns {Error} default - Unexpected error
 */
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypesPaged)
