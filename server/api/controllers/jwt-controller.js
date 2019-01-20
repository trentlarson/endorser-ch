import JwtService from '../services/jwt.service';

export class Controller {

  getByQuery(req, res) {
    JwtService.byQuery(req.query)
      .then(r => res.json(r));
  }

  getById(req, res) {
    JwtService
      .byId(req.params.id)
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  /**
  create(req, res) {
    JwtService
      .create(req.body.encoded)
      .then(r => res
        .status(201)
        .location(`<%= apiRoot %>/claim/${r.id}`)
        .json(r));
  }
  **/

  importClaims(req, res) {
    JwtService
      .createWithClaimRecord(req.body.jwtEncoded)
      .then(r => res
            .status(201)
            .location(`<%= apiRoot %>/claim/${r.id}`)
            .json(r));
  }

}

export default new Controller();
