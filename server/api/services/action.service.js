import util from 'util'
import R from 'ramda'

import l from '../../common/logger'
import db from './endorser.db.service'
import { buildConfirmationList } from './util'

class ActionService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.actionClaimById(id)
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
    // Note that the following is very similar to OrgService.getClaimsAndConfirmationsForRoleOnDate & TenureService.getClaimsAndConfirmationsAtPoint

    // retrieve "cac" (claim and confirmations), eg [{ action: { ACTION DATA }, confirmation: { ISSUER & ROW DATA }|null }, ...]
    let cacs = await db.retrieveActionClaimsAndConfirmationsForEventsSince(dateTime)

    // group by DID, eg {did1: [ ALL CACS FOR did1 ], did2: ...}
    let cacListsByDid = R.groupBy(cac => cac.action.agentDid)(cacs)
    // group by DID & action ID, eg {did1: {actionId1: [ CACS FOR did1 & actionId1 ], actionId2: ...}, did2: ...}
    let cacListsByDidThenAction = R.map(cacList => R.groupBy(cac => cac.action.id)(cacList))(cacListsByDid)
    // aggregate all confirmations for each DID-action
    // eg {did1: {actionId1: { "action": { ACTION DATA }, "confirmations": [ { ISSUER & ROW DATA }, ... ] }, actionId2: ...}, did2: ...}
    let cacObjectByDid = R.map(R.map(R.curry(buildConfirmationList)('action')))(cacListsByDidThenAction)
    // strip the values from the action ID keys
    // eg {did1: [ { "action": { ACTION DATA }, "confirmations": [ { ISSUER & ROW DATA }, ... ] } ], did2: ...}
    let cacListByDid = R.map(R.values)(cacObjectByDid)
    // create an array with "did" as key
    // eg [ {"did": did1, "actions": [ VALUES FROM PREV ] }, ... ]
    var result = []
    for (let key of R.keys(cacListByDid)) {
      result.push({did:key, actions:cacListByDid[key]})
    }
    return result
  }

}

export default new ActionService();
