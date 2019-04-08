import ActionService from '../services/action.service';

export class Controller {

  getById(req, res) {
    ActionService
      .byId(req.params.id, req.headers["some-did"])
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
