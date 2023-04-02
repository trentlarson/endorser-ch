import l from '../../common/logger'
import { dbService } from './endorser.db.service'
import { globalId, isGlobalUri } from './util'

class PlanService {

  // gets info rather than the initial signed claim
  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    return dbService.planInfoByHandleId(globalId(externalId))
  }

}

class ProjectService {

  // gets info rather than the initial signed claim
  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    return dbService.projectInfoByHandleId(globalId(externalId))
  }

}

module.exports = { planService: new PlanService(), projectService: new ProjectService() }
