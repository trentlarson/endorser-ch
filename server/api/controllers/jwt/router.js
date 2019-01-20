import * as express from 'express';
import controller from './controller';

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
 * Add a Claim JWT and insert claims into their own tables
 * @group jwt - Claim JWT storage
 * @route POST /api/claim
 * @param {EncodedJwt.model} jwt.body.required
 * @returns {object} 200 - internal ID of Claim JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/', controller.importClaims)
/**
 * Get all Claim JWTs
 * @group jwt - Claim JWT storage
 * @route GET /api/claim
 * @param {String} claimType.query.optional
 * @returns {Array.object} 200 - all Claim JWTs
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getByQuery)
/**
 * Get a Claim JWT
 * @group jwt - Claim JWT storage
 * @route GET /api/claim/{id}
 * @param {number} id.path.required - the ID of the Claim JWT record to retrieve
 * @returns {object} 200 - Claim JWT if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
/**
 * Add a Claim JWT raw, without any processing (not recommended)
 * @group jwt - Claim JWT storage
 * @route POST /api/claim/raw
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of Claim JWT
 * @returns {Error}  default - Unexpected error
 *
  .post('/raw', controller.create)
 */

