import * as express from 'express';
import controller from './action-controller';
import { UPORT_PUSH_TOKEN_HEADER } from '../services/util'

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
 * Get many actions
 * @group action - Action storage
 * @route GET /api/action/
 * @param {String} agentDid.query.optional
 * @param {number} eventRowId.query.optional
 * @param {String} eventOrgName.query.optional
 * @param {String} eventName.query.optional
 * @param {String} eventStartTime.query.optional
 * @returns {Array.object} 200 - many events (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getByQuery)

/**
 * Get an Action
 * @group action - Action storage
 * @route GET /api/action/{id}
 * @param {number} id.path.required - the ID of the Action record to retrieve
 * @returns {object} 200 - Action if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
