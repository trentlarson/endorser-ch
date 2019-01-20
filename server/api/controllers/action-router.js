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
 * Get an Action
 * @group action - Action storage
 * @route GET /api/action/{id}
 * @param {number} id.path.required - the ID of the Action record to retrieve
 * @returns {object} 200 - Action if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
