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

    let tcacs = await db.retrieveTenureClaimsAndConfirmationsAtPoint(lat, lon)
    // group all by DID
    let tcacListsByDid = R.groupBy(tcac => tcac.tenure.partyDid)(tcacs)
    // now make a group for each DID
    let tcacListsByDidThenTenure = R.map(tcacList => R.groupBy(tcac => tcac.tenure.id)(tcacList))(tcacListsByDid)
    // now aggregate all confirmations for each DID-tenure
    let tcacObjectByDid = R.map(R.map(R.curry(buildConfirmationList)('tenure')))(tcacListsByDidThenTenure)
    let tcacListByDid = R.map(R.values)(tcacObjectByDid)
    // now create an array so that the DIDs aren't used as keys
    var result = []
    for (let key of R.keys(tcacListByDid)) {
      result.push({did:key, tenures:tcacListByDid[key]})
    }
    return result;
  }

}

export default new TenureService();
