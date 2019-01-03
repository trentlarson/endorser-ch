import * as express from 'express';
import controller from './controller';

export default express
  .Router()
/**
 * This is isn't complete: see ../../../common/swagger/Api.yaml in the code history.
 * @route POST /api/examples
 */
  .post('/', controller.create)
/**
 * @route GET /api/examples
 */
  .get('/', controller.all)
/**
 * @route GET /api/examples/{id}
 * @param {string} id.path.required - the ID of the example to retrieve
 */
  .get('/:id', controller.byId);
