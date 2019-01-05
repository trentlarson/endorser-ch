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
    let jwtId = db.jwtInsert(encoded);
  }

  async createWithClaimRecords(encoded) {
    l.info(`${this.constructor.name}.createWithClaimRecords(${encoded})`);
    let jwtId = await db.jwtInsert(encoded);

    // these lines are lifted from didJwt.verifyJWT
    const {payload, header, signature, data} = didJwt.decodeJWT(encoded)
    l.debug(payload, "payload")
    l.debug(header, "header")
    l.debug(signature, "signature")
    l.debug(data, "data")
    const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
    l.debug(doc, "doc")
    l.debug(authenticators, "authenticators")
    l.debug(issuer, "issuer")

    // this is the same as the doc.publicKey in my example
    //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

    if (payload.claim && payload.claim['@type'] === 'AttendedAction') {
      var event = await db.eventByNameTime(payload.claim.object.name, payload.claim.object.startTime)

      var eventId
      if (event !== null) {
        eventId = event.id
      } else {
        eventId = await db.eventInsert(payload.claim.object.name, payload.claim.object.startTime)
        l.debug(`New event ${eventId}`)
      }

      // doc.id is the DID
      let attId = await db.attendanceInsert(doc.id, eventId)
      l.debug(`New attendance ${attId}`)
    }

    return jwtId
  }

}

export default new JwtService();
