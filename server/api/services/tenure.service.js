import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';

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

  async byPoint(lat, lon) {
    l.info(`${this.constructor.name}.byPoint(${lat}, ${lon})`);
    let resultData = await db.tenureByPoint(lat, lon)
    return resultData;
  }

  async claimsAndConfirmationsByPoint(lat, lon) {
    l.info(`${this.constructor.name}.claimsAndConfirmationsByPoint(${lat}, ${lon})`);
    let resultData = await db.retrieveTenureClaimsAndConfirmationsByPoint(lat, lon)
    return resultData;
  }

}

export default new TenureService();
