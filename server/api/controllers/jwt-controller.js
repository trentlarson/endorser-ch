import JwtService from '../services/jwt.service';

export class Controller {

  getById(req, res) {
    JwtService
      .byId(req.params.id, req.headers["some-did"])
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    JwtService.byQuery(req.query)
      .then(r => res.json(r));
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

  importClaim(req, res) {
    JwtService
      .createWithClaimRecord(req.body.jwtEncoded)
      .then(r => res
            .status(201)
            .location(`<%= apiRoot %>/claim/${r.id}`)
            .json(r));
  }

}

export default new Controller();
