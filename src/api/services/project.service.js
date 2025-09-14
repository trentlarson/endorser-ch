import l from '../../common/logger'
import { dbService } from './endorser.db.service'
import { globalId, isGlobalUri } from './util'

class PlanService {

  // gets info rather than the initial signed claim
  infoByClaimIdOrHandleId(someId) {
    l.trace(`${this.constructor.name}.byExternalId(${someId})`);
    if (isGlobalUri(someId)) {
      return dbService.planInfoByHandleId(someId)
    } else {
      return dbService.planInfoByClaimId(someId)
    }
  }

  // gets info for multiple handle IDs
  infoByHandleIds(handleIds) {
    l.trace(`${this.constructor.name}.infoByHandleIds(${JSON.stringify(handleIds)})`);
    return dbService.planInfoByHandleIds(handleIds)
  }

}

module.exports = { planService: new PlanService() }
