import * as express from 'express';
import controller from './controller';

export default express
  .Router()
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
 * Add a JWT that encodes an attendance claim
 * @route POST /api/jwt/attendance
 * @group jwt - JWT storage
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/attendance', controller.importAttendanceJwt)
