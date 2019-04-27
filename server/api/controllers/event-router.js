import * as express from 'express';
import controller from './event-controller';
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
 * Get many events
 * @group event - Event storage
 * @route GET /api/event
 * @param {String} orgName.query.optional
 * @param {String} name.query.optional
 * @param {String} startTime.query.optional
 * @returns {Array.object} 200 - many events (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getByQuery)

/**
 * Get an event
 * @group event - Event storage
 * @route GET /api/event/{id}
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {object} 200 - event if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)

/**
 * @typedef ActionClaim
 * @property {number} actionId.required
 * @property {string} actionDid.required
 */

/**
 * @typedef Confirmation
 * @property {number} id.required
 * @property {string} did.required
 * @property {number} actionRowId.required
 */

/**
 * @typedef ActionClaimsConfirmations
 * @property {ActionClaim} action.required
 * @property {Array.Confirmation} confirmation.required
 */

/**
 * Get claims and confirmations for an event
 * @group event - Event storage
 * @route GET /api/event/{id}/actionClaimsAndConfirmations
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {Array.ActionClaimsConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id/actionClaimsAndConfirmations', controller.getActionClaimsAndConfirmationsByEventId)
