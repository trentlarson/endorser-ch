import ActionService from '../services/action.service';

export class Controller {

  getById(req, res) {
    ActionService
      .byId(req.params.id)
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getActionClaimsAndConfirmationsSince(req, res) {
    ActionService.getActionClaimsAndConfirmationsForEventsSince(req.query.dateTime)
      .then(r => res.json(r));
  }

}

export default new Controller();
