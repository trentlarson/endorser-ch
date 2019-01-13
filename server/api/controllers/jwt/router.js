import * as express from 'express';
import controller from './controller';

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  })

/**
 * @typedef EncodedJwt
 * @property {string} encoded.required
 */

/**
 * Add a JWT and insert claims into their own tables
 * @group jwt - JWT storage
 * @route POST /api/jwt
 * @param {EncodedJwt.model} jwt.body.required
 * @returns {object} 200 - internal ID of JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/', controller.importClaims)
/**
 * Get all JWTs
 * @group jwt - JWT storage
 * @route GET /api/jwt
 * @returns {Array.object} 200 - all JWTs
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getAll)
/**
 * Get a JWT
 * @group jwt - JWT storage
 * @route GET /api/jwt/{id}
 * @param {number} id.path.required - the ID of the JWT record to retrieve
 * @returns {object} 200 - JWT if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
/**
 * Add a JWT raw, without any processing (not recommended)
 * @group jwt - JWT storage
 * @route POST /api/jwt/raw
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of JWT
 * @returns {Error}  default - Unexpected error
 *
  .post('/raw', controller.create)
 */
