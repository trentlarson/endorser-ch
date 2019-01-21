import * as express from 'express';
import controller from './action-controller';

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
  .get('/actionClaimsAndConfirmationsSince', controller.getActionClaimsAndConfirmationsSince)

