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

}

export default new Controller();
