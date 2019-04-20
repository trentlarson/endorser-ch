import * as express from 'express';

import TenureService from '../services/tenure.service';
class TenureController {
  getById(req, res) {
    TenureService.byId(req.params.id)
      .then(r => res.json(r));
  }
  getByQuery(req, res) {
    TenureService.byQuery()
      .then(r => res.json(r));
  }
}
let tenureController = new TenureController();

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
 * Get many tenures
 * @group tenure - Tenure storage
 * @route GET /api/tenure/
 * @returns {Array.object} 200 - many tenures (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/', tenureController.getByQuery)

/**
 * Get a Tenure
 * @group tenure - Tenure storage
 * @route GET /api/tenure/{id}
 * @param {number} id.path.required - the ID of the Tenure record to retrieve
 * @returns {object} 200 - Tenure if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
  .get('/:id', tenureController.getById)
