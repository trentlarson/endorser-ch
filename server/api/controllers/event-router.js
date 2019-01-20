import * as express from 'express';
import controller from './event-controller';

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
 * Get an event
 * @group event - Event storage
 * @route GET /api/event/{id}
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {object} 200 - event if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', controller.getById)
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
 * @typedef ActionClaimsConfirmations
 * @property {string} actionId.required
 * @property {string} actionDid.required
 * @property {string} claimEncoded.required
 * @property {string} confirmationId.optional
 * @property {string} confirmationDid.optional
 */

/**
 * Get claims and confirmations for an event
 * @group event - Event storage
 * @route GET /api/event/{id}/actionClaimsAndConfirmations
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {Array.ActionClaimsConfirmations} 200 - events
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id/actionClaimsAndConfirmations', controller.getActionClaimsAndConfirmationsByEventId)
