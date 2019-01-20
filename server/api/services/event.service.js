import l from '../../common/logger';
import db from './endorser.db.service';

class EventService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.eventById(id);
  }

}

export default new EventService();
