import l from '../../common/logger';
import db from './endorser.db.service';

class JwtService {
  all() {
    l.info(`${this.constructor.name}.all()`);
    return db.jwtAll();
  }

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.jwtById(id);
  }

  create(encoded) {
    l.info(`${this.constructor.name}.create(${encoded})`);
    return db.jwtInsert(encoded);
  }
}

export default new JwtService();
