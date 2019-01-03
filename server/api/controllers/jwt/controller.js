import JwtService from '../../services/jwt.service';

export class Controller {
  all(req, res) {
    JwtService.all()
      .then(r => res.json(r));
  }

  byId(req, res) {
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
        .location(`<%= apiRoot %>/examples/${r.id}`)
        .json(r));
  }
}
export default new Controller();
