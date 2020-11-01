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
    let resultData = await db.retrieveActionClaimsAndConfirmationsByEventId(id)
    let acacListById = R.groupBy(acac => ""+acac.action.id)(resultData)
    let acacListByAction = R.map(R.curry(buildConfirmationList)('action'))(acacListById)
    return R.values(acacListByAction)
  }

  /**
   Result format is:
   [
     { action: { id, agentDid, eventRowId }, confirmations: [ { id, issuer, actionRowId } ... ] }
     ...
   ]
   */
  async getActionClaimsAndConfirmationsByEventData(event) {
    l.info(`${this.constructor.name}.getActionClaimsAndConfirmationsByEventData(${util.inspect(event)})`);
    if (!event.organizer
        || !event.organizer.name
        || !event.name
        || !event.startTime) {
      return Promise.reject("Requested event data but didn't supply organizer.name or name or startTime: " + JSON.stringify(event))
    } else {
      let claimsAndConfirmations = await db.retrieveActionClaimsAndConfirmationsByEventData(event.organizer.name, event.name, event.startTime)
      let acacListById = R.groupBy(acac => ""+acac.action.id)(claimsAndConfirmations)
      let acacListByAction = R.map(R.curry(buildConfirmationList)('action'))(acacListById)
      let result = R.values(acacListByAction)
      return result
    }
  }

}

export default new EventService();
