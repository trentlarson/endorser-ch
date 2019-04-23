import EventService from '../services/event.service';
import { hideDidsForUser } from '../services/network-cache.service'

export class Controller {

  getById(req, res) {
    EventService
      .byId(req.params.id)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    EventService.byQuery(req.query)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

  getActionClaimsAndConfirmationsByEventId(req, res) {
    EventService.getActionClaimsAndConfirmationsByEventId(req.params.id)
      .then(result => hideDidsForUser(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

}

export default new Controller();
