import JwtService from '../../services/jwt.service';

export class Controller {

  getAll(req, res) {
    JwtService.all()
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

  create(req, res) {
    JwtService
      .create(req.body.encoded)
      .then(r => res
        .status(201)
        .location(`<%= apiRoot %>/jwt/${r.id}`)
        .json(r));
  }

  importClaims(req, res) {
    JwtService
      .createWithClaimRecords(req.body.encoded)
      .then(r => res
            .status(201)
            .location(`<%= apiRoot %>/jwt/${r.id}`)
            .json(r));
  }

}

export default new Controller();
