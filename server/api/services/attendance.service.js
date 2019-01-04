import l from '../../common/logger';
import db from './endorser.db.service';

class AttendanceService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.attendanceById(id);
  }

  create(did, eventId) {
    l.info(`${this.constructor.name}.create(${did}, ${eventId})`);
    return db.attendanceInsert(did, eventId);
  }
}

export default new AttendanceService();
