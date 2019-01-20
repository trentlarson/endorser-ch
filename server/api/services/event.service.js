import util from 'util'
import R from 'ramda'

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

  // create confirmation list from a list of actionClaimsAndConfirmations for the same action
  // internal helper function
  buildConfirmationList(acacList) {
    return {
      action: acacList[0].action,
      confirmations: (acacList.length == 1 && !acacList[0].confirmation)
        ? []
        : R.map(acac=>acac.confirmation)(acacList)
    }
  }

  async getActionClaimsAndConfirmationsByEventId(id) {
    l.info(`${this.constructor.name}.getActionClaimsAndConfirmationsByEventId(${id})`)
    let resultData = await db.getActionClaimsAndConfirmationsByEventId(id)
    let acacListById = R.groupBy(acac => ""+acac.action.id)(resultData)
    let acacListByAction = R.map(acacList => this.buildConfirmationList(acacList))(acacListById)
    return R.values(acacListByAction)
  }

}

export default new EventService();
