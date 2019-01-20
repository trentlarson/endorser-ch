import EventService from '../services/event.service';

export class Controller {

  getById(req, res) {
    EventService
      .byId(req.params.id)
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      });
  }

  getByQuery(req, res) {
    EventService.byQuery(req.query)
      .then(r => res.json(r));
  }

}

export default new Controller();
