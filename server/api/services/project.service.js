import l from '../../common/logger'
import db from './endorser.db.service'
import { GLOBAL_PLAN_ID_IRI_PREFIX, GLOBAL_PROJECT_ID_IRI_PREFIX, isGlobalUri } from './util'

class PlanService {

  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    if (!isGlobalUri(externalId)) {
      // assume they're requesting an endorser.ch URI
      externalId = GLOBAL_PLAN_ID_IRI_PREFIX + externalId
    }
    return db.planInfoByExternalId(externalId)
  }

}

class ProjectService {

  // gets info but not the full claim
  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    if (!isGlobalUri(externalId)) {
      // assume they're requesting an endorser.ch URI
      externalId = GLOBAL_PROJECT_ID_IRI_PREFIX + externalId
    }
    return db.projectInfoByExternalId(externalId)
  }

}

module.exports = { planService: new PlanService(), projectService: new ProjectService() }
