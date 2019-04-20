import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';

class TenureService {

  async byPoint(lat, lon) {
    l.info(`${this.constructor.name}.byPoint(${lat}, ${lon})`);
    let resultData = await db.tenureByPoint(lat, lon)
    return resultData;
  }

  async getClaimsAndConfirmationsByPoint(lat, lon) {
    l.info(`${this.constructor.name}.getClaimsAndConfirmationsByPoint(${lat}, ${lon})`);
    let resultData = await db.getTenureClaimsAndConfirmationsByPoint(lat, lon)
    return resultData;
  }

}

export default new TenureService();
