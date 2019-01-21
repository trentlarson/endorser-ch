import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';
import { buildConfirmationList } from './util'

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
    l.info(`${this.constructor.name}.getActionClaimsAndConfirmationsByEventId(${id})`)
    let resultData = await db.getActionClaimsAndConfirmationsByEventId(id)
    let acacListById = R.groupBy(acac => ""+acac.action.id)(resultData)
    let acacListByAction = R.map(buildConfirmationList)(acacListById)
    return R.values(acacListByAction)
  }

}

export default new EventService();
