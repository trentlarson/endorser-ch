import * as express from 'express'
import { withKeysSorted } from '../services/util'

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
 * Get sorted version of any object (using the function used internally for generating preimages)
 * @group report - Reports
 * @route GET /api/reports/sortedKeys
 * @param {obj} date.query.optional - the object which to sort
 * @returns {Array.ActionClaimsConfirmations} 200 - object with the order of all keys sorted
 * @returns {Error}  default - Unexpected error
 */
  .get('/objectWithKeysSorted', (req, res) => res.json(withKeysSorted(JSON.parse(req.query.object))))
