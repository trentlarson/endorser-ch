import * as express from 'express'
import actionController from './action-controller'
import TenureService from '../services/tenure.service';

export class TenureController {
  getByPoint(req, res) {
    TenureService.byPoint(req.query.lat, req.query.lon)
      .then(r => res.json(r));
  }
}
let tenureController = new TenureController();


export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  })

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

/**
 * Get claims and confirmations for individual
 * @group report - Reports
 * @route GET /api/reports/actionClaimsAndConfirmations
 * @param {datetime} date.query.optional - the date from which to show actionclaims
 * @returns {Array.ActionClaimsConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error}  default - Unexpected error
 */
  .get('/actionClaimsAndConfirmationsSince', actionController.getActionClaimsAndConfirmationsSince)

/**
 * Get tenure claims for a point
 * @group action - Reports
 * @route GET /api/reports/tenureClaimsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/tenureClaimsAtPoint', tenureController.getByPoint)
