import EventService from '../services/event.service';
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

export class Controller {

  getById(req, res) {
    EventService
      .byId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    EventService.byQuery(req.query)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

  getActionClaimsAndConfirmationsByEventId(req, res) {
    EventService.getActionClaimsAndConfirmationsByEventId(req.params.id)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r));
  }

}

export default new Controller();
