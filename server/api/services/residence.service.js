import util from 'util'
import R from 'ramda'

import l from '../../common/logger';
import db from './endorser.db.service';

class ResidenceService {

  async byPoint(lat, lon) {
    l.info(`${this.constructor.name}.byPoint(${lat}, ${lon})`);
    let resultData = await db.residenceByPoint(lat, lon)
    return resultData;
  }

}

export default new ResidenceService();
