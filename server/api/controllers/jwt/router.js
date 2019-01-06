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
 * Add a JWT
 * @route POST /api/jwt
 * @group jwt - JWT storage
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/', controller.create)
/**
 * Get all JWTs
 * @route GET /api/jwt
 * @group jwt - JWT storage
 * @returns {Array.object} 200 - all JWTs
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getAll)
/**
 * Get a JWT
 * @route GET /api/jwt/{id}
 * @group jwt - JWT storage
 * @param {string} id.path.required - the ID of the JWT record to retrieve
 * @returns {object} 200 - JWT if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
/**
 * Add a JWT and insert claims into their own tables
 * @route POST /api/jwt/attendance
 * @group jwt - JWT storage
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/claims', controller.importClaims)
