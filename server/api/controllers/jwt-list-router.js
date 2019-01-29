import * as express from 'express';
import controller from './jwt-controller';

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
 * @typedef EncodedJwt
 * @property {string} jwtEncoded.required
 */

/**
 * Add multiple Claim JWTs and insert elements into their own tables
 * @group jwt - Claim JWT storage
 * @route POST /api/claims
 * @param {Array.EncodedJwt.model} jwt.body.required
 * @returns {Array.object} 200 - array of internal IDs of Claim JWTs
 * @returns {Error}  default - Unexpected error
 */
  .post('/', controller.importClaimList)
