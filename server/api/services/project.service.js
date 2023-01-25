import l from '../../common/logger'
import db from './endorser.db.service'
import { GLOBAL_ENTITY_ID_IRI_PREFIX, isGlobalUri } from './util'

class PlanService {

  // gets info rather than the initial signed claim
  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    if (!isGlobalUri(externalId)) {
      // assume they're requesting an endorser.ch URI
      externalId = GLOBAL_ENTITY_ID_IRI_PREFIX + externalId
    }
    return db.planInfoByFullIri(externalId)
  }

}

class ProjectService {

  // gets info rather than the initial signed claim
  infoByExternalId(externalId) {
    l.trace(`${this.constructor.name}.byExternalId(${externalId})`);
    if (!isGlobalUri(externalId)) {
      // assume they're requesting an endorser.ch URI
      externalId = GLOBAL_ENTITY_ID_IRI_PREFIX + externalId
    }
    return db.projectInfoByFullIri(externalId)
  }

}

module.exports = { planService: new PlanService(), projectService: new ProjectService() }
