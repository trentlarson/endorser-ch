import didJwt from 'did-jwt'
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
      .catch(err => res.status(500).json(""+err).end())
  }

  getByQuery(req, res) {
    ActionService.byQuery(req.query)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }

  getActionClaimsAndConfirmationsSince(req, res) {
    ActionService.getActionClaimsAndConfirmationsForEventsSince(req.query.dateTime)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }

}

export default new Controller();
