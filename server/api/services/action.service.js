import l from '../../common/logger';
import db from './endorser.db.service';

class ActionService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.actionById(id);
  }

  async byQuery(params) {
    l.info(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    if (params.id) {
      params.rowid = params.id
      delete params.id
    }
    let resultData = await db.actionByParams(params)
    let result = resultData.map(j => ({id:j.id, issuedAt:j.issuedAt, subject:j.subject, claimContext:j.claimContext, claimType:j.claimType, claimEncoded:j.claimEncoded}))
    return result;
  }

}

export default new ActionService();
