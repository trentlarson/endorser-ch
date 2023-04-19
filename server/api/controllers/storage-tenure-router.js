import * as express from 'express';

import TenureService from '../services/tenure.service';
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'
class TenureController {
  getById(req, res) {
    TenureService.byId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end() })
  }
  getByQuery(req, res) {
    TenureService.byQuery()
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end() })
  }
}
let tenureController = new TenureController();

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
 * Get many tenures
 * @group storage of tenures - Tenure storage
 * @route GET /api/tenure/
 * @returns {array.object} 200 - many tenures (up to 50)
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/', tenureController.getByQuery)

/**
 * Get a Tenure
 * @group storage of tenures - Tenure storage
 * @route GET /api/tenure/{id}
 * @param {number} id.path.required - the ID of the Tenure record to retrieve
 * @returns {object} 200 - Tenure if it exists, otherwise 404
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id', tenureController.getById)
