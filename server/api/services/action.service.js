import util from 'util'
import R from 'ramda'

import l from '../../common/logger'
import db from './endorser.db.service'
import { hideDidsForUser } from './network-cache.service'
import { buildConfirmationList, HIDDEN_TEXT } from './util'

async function getNetwork(requesterDid) {
  return db.getNetwork(requesterDid)
}

class ActionService {

  byId(id, requesterDid) {
    l.info(`${this.constructor.name}.byId(${id},${requesterDid})`);
    return db.actionClaimById(id)
      .then(async actionClaim => {
        return hideDidsForUser(requesterDid, actionClaim)
      })
  }

  async byQuery(params) {
    l.info(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    if (params.id) {
      params.rowid = params.id
      delete params.id
    }
    let resultData = await db.actionClaimsByParams(params)
    return resultData
  }

  async getActionClaimsAndConfirmationsForEventsSince(dateTime) {
    let resultData = await db.retrieveActionClaimsAndConfirmationsForEventsSince(dateTime)
    // group all actions by DID
    let acacListsByDid = R.groupBy(acac => acac.action.agentDid)(resultData)
    // now make an action group for each DID
    let acacListsByDidThenAction = R.map(acacList => R.groupBy(acac => acac.action.id)(acacList))(acacListsByDid)
    // now aggregate all confirmations for each DID-action
    let acacObjectByDid = R.map(R.map(buildConfirmationList))(acacListsByDidThenAction)
    let acacListByDid = R.map(R.values)(acacObjectByDid)
    return acacListByDid
  }

}

export default new ActionService();
