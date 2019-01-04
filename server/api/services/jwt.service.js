import l from '../../common/logger';
import db from './endorser.db.service';
import didJwt from 'did-jwt'
// I wish this was exposed in the did-jwt module!
import VerifierAlgorithm from '../../../node_modules/did-jwt/lib/VerifierAlgorithm'
// I couldn't figure out how to import this directly from the module.  Sheesh.
const resolveAuthenticator = require('./crypto/JWT').resolveAuthenticator

require("ethr-did-resolver").default() // loads resolver for "did:ethr"

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

  async createWithAttendance(encoded) {
    l.info(`${this.constructor.name}.createWithAttendance(${encoded})`);
    let jwtId = await db.jwtInsert(encoded);
    // these lines are lifted from didJwt.verifyJWT, but I don't want all of it
    const {payload, header, signature, data} = didJwt.decodeJWT(encoded)
    const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
    const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)
    console.log("signer", signer)
    console.log("doc", doc)
    console.log("claim", payload.claim)

    return jwtId
  }

}

export default new JwtService();
