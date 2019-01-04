import l from '../../common/logger';
import db from './endorser.db.service';

class EventService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.eventById(id);
  }

  create(title, startTime) {
    l.info(`${this.constructor.name}.create(${title}, ${startTime})`);
    return db.eventInsert(did, eventId);
  }

}

export default new EventService();
