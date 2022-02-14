import * as express from 'express'
import * as R from 'ramda'

import { UPORT_PUSH_TOKEN_HEADER } from '../services/util'
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

import DbService from '../services/endorser.db.service';
class DbController {
  getAllIssuerClaimTypes(req, res, next) {
    const claimTypes = JSON.parse(req.query.claimTypes)
    if (!Array.isArray(claimTypes)) {
      return res.status(400).json({error: "Parameter 'claimTypes' should be an array but got: " + req.query.claimTypes}).end()
    }
    DbService.allIssuerClaimTypes(res.locals.tokenIssuer, claimTypes, req.query.afterId)
      .then(jwts => jwts.map(jwt => R.set(R.lensProp('claim'), JSON.parse(jwt.claim), jwt)))
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => { req.resultJsonWrap = { result: r }; next(); })
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
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group report - Reports
 * @route GET /api/report/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive), for pagination
 * @returns {Array.String} 200 - claims issued by this user with any of those claim types
 * @returns {Error} default - Unexpected error
 */
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypes)

