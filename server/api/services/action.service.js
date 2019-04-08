import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';
import { buildConfirmationList, HIDDEN_TEXT } from './util'

class ActionService {

  byId(id, requesterDid) {
    l.info(`${this.constructor.name}.byId(${id},${requesterDid})`);
    return db.actionClaimById(id)
      .then(actionClaim => {
        if (!actionClaim) {
          return null
        } else {
          return db.inNetwork(requesterDid, [actionClaim.agentDid])
            .then(rows => {
              if (rows.length == 0) {
                actionClaim["agentDid"] = HIDDEN_TEXT
              }
              return actionClaim
            })
        }
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
