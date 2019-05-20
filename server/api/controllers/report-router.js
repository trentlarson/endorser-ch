import * as express from 'express'
import actionController from './action-controller'
import { UPORT_PUSH_TOKEN_HEADER } from '../services/util'

import TenureService from '../services/tenure.service';
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'
import { getSeesDids } from '../services/network-cache.service'
class TenureController {
  getAtPoint(req, res) {
    TenureService.atPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).end())
  }
  getClaimsAndConfirmationsAtPoint(req, res) {
    TenureService.getClaimsAndConfirmationsAtPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).end())
  }
  getCanSeeDids(req, res) {
    getSeesDids(res.locals.tokenIssuer)
      .then(r => res.json(r))
      .catch(err => res.status(500).end())
  }
}
let tenureController = new TenureController();


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
 * Get claims and confirmations for individual
 * @group report - Reports
 * @route GET /api/report/actionClaimsAndConfirmations
 * @param {datetime} date.query.optional - the date from which to show actionclaims
 * @returns {Array.ActionClaimsConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error}  default - Unexpected error
 */
  .get('/actionClaimsAndConfirmationsSince', actionController.getActionClaimsAndConfirmationsSince)

/**
 * Get tenure claims for a point
 * @group report - Reports
 * @route GET /api/report/tenureClaimsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/tenureClaimsAtPoint', tenureController.getAtPoint)

/**
 * Get tenure claims and confirmations for a point
 * @group report - Reports
 * @route GET /api/report/tenureClaimsAndConfirmationsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/tenureClaimsAndConfirmationsAtPoint', tenureController.getClaimsAndConfirmationsAtPoint)

/**
 * Get all DIDs this person can see
 * @group report - Reports
 * @route GET /api/report/canSeeDids
 * @returns {Array.object} 200 - list of DIDs user can see
 * @returns {Error}  default - Unexpected error
 */
  .get('/canSeeDids', tenureController.getCanSeeDids)
