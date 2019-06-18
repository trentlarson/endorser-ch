import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';
import { buildConfirmationList } from './util'

class TenureService {

  async byId(tenureId) {
    l.info(`${this.constructor.name}.byId(${tenureId})`);
    let resultData = await db.tenureClaimById(tenureId)
    return resultData;
  }

  async byQuery() {
    l.info(`${this.constructor.name}.byQuery()`);
      let resultData = await db.tenureClaims()
      return resultData;
    }

  async atPoint(lat, lon) {
    l.info(`${this.constructor.name}.atPoint(${lat}, ${lon})`);
    let resultData = await db.tenureByPoint(lat, lon)
    return resultData;
  }

  async getClaimsAndConfirmationsAtPoint(lat, lon) {
    l.info(`${this.constructor.name}.getClaimsAndConfirmationsAtPoint(${lat}, ${lon})`);
    // Note that this is very similar to ActionService.getActionClaimsAndConfirmationsForEventsSince & OrgService.getActionClaimsAndConfirmationsForRoleOnDate

    // retrieve "cac" (claim and confirmations), eg [{ tenure: { TENURE DATA }, confirmation: { ISSUER & ROW DATA }|null }, ...]
    let cacs = await db.retrieveTenureClaimsAndConfirmationsAtPoint(lat, lon)

    // group by DID, eg {did1: [ ALL CACS FOR did1 ], did2: ...}
    let cacListsByDid = R.groupBy(cac => cac.tenure.partyDid)(cacs)
    // group by DID & tenure ID, eg {did1: {tenureId1: [ CACS FOR did1 & tenureId1 ], tenureId2: ...}, DID2: ...}
    let cacListsByDidThenTenure = R.map(cacList => R.groupBy(cac => cac.tenure.id)(cacList))(cacListsByDid)
    // aggregate all confirmations for each DID-tenure
    // eg {did1: {tenureId1: { "tenure": { TENURE DATA }, "confirmations": [ { ISSUER & ROW DATA }, ... ] }, tenureId2: ...}, did2: ...}
    let cacObjectByDid = R.map(R.map(R.curry(buildConfirmationList)('tenure')))(cacListsByDidThenTenure)
    // strip the values from the tenure ID keys
    // eg {did1: [ { "tenure": { TENURE DATA }, "confirmations": [ { ISSUER & ROW DATA }, ... ] } ], did2: ...}
    let cacListByDid = R.map(R.values)(cacObjectByDid)
    // create an array with "did" as key
    // eg [ {"did": did1, "tenures": [ VALUES FROM PREV ] }, ... ]
    var result = []
    for (let key of R.keys(cacListByDid)) {
      result.push({did:key, tenures:cacListByDid[key]})
    }
    return result;
  }

}

export default new TenureService();
