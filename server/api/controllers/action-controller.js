import didJwt from 'did-jwt'
import ActionService from '../services/action.service'
import { hideDidsForUser } from '../services/network-cache.service'

export class Controller {

  getById(req, res) {
    ActionService
      .byId(req.params.id)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    ActionService.byQuery(req.query)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

  getActionClaimsAndConfirmationsSince(req, res) {
    ActionService.getActionClaimsAndConfirmationsForEventsSince(req.query.dateTime)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

}

export default new Controller();
