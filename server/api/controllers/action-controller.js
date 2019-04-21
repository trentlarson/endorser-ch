import didJwt from 'did-jwt'
import ActionService from '../services/action.service'
import JwtService from '../services/jwt.service'
import { PUSH_TOKEN_HEADER } from '../services/util'

export class Controller {

  getById(req, res) {
    let jwt = req.headers[PUSH_TOKEN_HEADER.toLowerCase()]
    if (!jwt) {
      res.status(401).json('Missing JWT').end()
    } else {
      JwtService.decodeAndVerifyJwt(jwt)
        .then(({payload, header, signature, data, doc, authenticators, issuer}) => {
          //console.log("Elements of the decoded JWT", {payload, header, signature, data, doc, authenticators, issuer})
          if (!payload || !header) {
            res.status(401).json('Unverified JWT').end()
          } else if (payload.exp < Math.floor(new Date().getTime() / 1000) ) {
            res.status(401).json('JWT Expired').end()
          } else if (header.typ === 'none') {
            res.status(401).json('Insecure JWT type').end()
          } else {
            ActionService
              .byId(req.params.id, payload.iss)
              .then(r => {
                if (r) res.json(r);
                else res.status(404).end();
              });
          }
        })
    }
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
