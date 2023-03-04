import ActionService from '../services/action.service'
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

export class Controller {

  getById(req, res) {
    ActionService
      .byId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      })
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }

  getByQuery(req, res) {
    ActionService.byQuery(req.query)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
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
 * Get many actions
 * @group storage of actions - Action storage
 * @route GET /api/action
 * @param {String} agentDid.query.optional
 * @param {number} eventRowId.query.optional
 * @param {String} eventOrgName.query.optional
 * @param {String} eventName.query.optional
 * @param {String} eventStartTime.query.optional
 * @returns {Array.object} 200 - many events (up to 50)
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/', controller.getByQuery)

/**
 * Get an Action
 * @group storage of actions - Action storage
 * @route GET /api/action/{id}
 * @param {number} id.path.required - the ID of the Action record to retrieve
 * @returns {object} 200 - Action if it exists, otherwise 404
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id', controller.getById)
