import util from 'util'

import l from '../../common/logger';
import db from './endorser.db.service';

class EventService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.eventById(id);
  }

  async byQuery(params) {
    l.info(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    let resultData = await db.eventsByParams(params)
    return resultData;
  }

  async getActionClaimsAndConfirmationsByEventId(id) {
    l.info(`${this.constructor.name}.getActionClaimsAndConfirmationsByEventId(${id})`);
    let resultData = await db.getActionClaimsAndConfirmationsByEventId(id)
    return resultData;
  }

}

export default new EventService();
