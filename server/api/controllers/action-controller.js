import didJwt from 'did-jwt'
import ActionService from '../services/action.service'
import JwtService from '../services/jwt.service'
import { PUSH_TOKEN_HEADER } from '../services/util'

export class Controller {

  getById(req, res) {
    ActionService
      .byId(req.params.id, res.locals.tokenIssuer)
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    ActionService.byQuery(req.query)
      .then(r => res.json(r));
  }

  getActionClaimsAndConfirmationsSince(req, res) {
    ActionService.getActionClaimsAndConfirmationsForEventsSince(req.query.dateTime)
      .then(r => res.json(r));
  }

}

export default new Controller();
