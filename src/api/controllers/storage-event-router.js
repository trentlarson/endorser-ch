import EventService from '../services/event.service';
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

export class Controller {

  getById(req, res) {
    EventService
      .byId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      })
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

  getByQuery(req, res) {
    EventService.byQuery(req.query)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

  getActionClaimsAndConfirmationsByEventId(req, res) {
    EventService.getActionClaimsAndConfirmationsByEventId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

  getActionClaimsAndConfirmationsByEventData(req, res) {
    EventService.getActionClaimsAndConfirmationsByEventData(JSON.parse(req.query.event))
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

}

let controller = new Controller();



import * as express from 'express';

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
  })

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

/**
 * Get many events
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group storage of events - Event storage
 * @route GET /api/event
 * @param {String} orgName.query.optional
 * @param {String} name.query.optional
 * @param {String} startTime.query.optional
 * @returns {array.EventSummary} 200 - many events (up to 50)
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/', controller.getByQuery)

/**
 * @typedef ActionSummary
 * @property {number} rowId.required
 * @property {string} agentDid.required
 * @property {number} eventRowId.required
 */

/**
 * @typedef Confirmation
 * @property {number} id.required
 * @property {string} issuer.required
 * @property {number} actionRowId.required
 */

/**
 * @typedef Organizer
 * @property {string} name.required
 */

/**
 * @typedef EventInput
 * @property {Organizer} organizer.required
 * @property {string} name.required
 * @property {string} startTime.required
 */

/**
 * @typedef EventSummary
 * @property {string} orgName.required
 * @property {string} name.required
 * @property {string} startTime.required
 */

/**
 * @typedef ActionSummaryAndConfirmations
 * @property {ActionSummary} action.required
 * @property {array.Confirmation} confirmation.required
 */

/**
 * Get claims and confirmations for an event
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group storage of events - Event storage
 * @route GET /api/event/actionClaimsAndConfirmations
 * @param {EventInput} event.query.required - the event data
 * @returns {array.ActionSummaryAndConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/actionClaimsAndConfirmations', controller.getActionClaimsAndConfirmationsByEventData)

/**
 * Get an event
 * @group storage of events - Event storage
 * @route GET /api/event/{id}
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {object} 200 - event if it exists, otherwise 404
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id', controller.getById)

/**
 * Get claims and confirmations for an event
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group storage of events - Event storage
 * @route GET /api/event/{id}/actionClaimsAndConfirmations
 * @param {number} id.path.required - the ID of the event record to retrieve
 * @returns {array.ActionSummaryAndConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id/actionClaimsAndConfirmations', controller.getActionClaimsAndConfirmationsByEventId)
