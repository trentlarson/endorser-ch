import l from '../../common/logger';
import base64url from 'base64url'
import db from './endorser.db.service';
import didJwt from 'did-jwt'
// I wish this was exposed in the did-jwt module!
import VerifierAlgorithm from '../../../node_modules/did-jwt/lib/VerifierAlgorithm'
// I couldn't figure out how to import this directly from the module.  Sheesh.
const resolveAuthenticator = require('./crypto/JWT').resolveAuthenticator

require("ethr-did-resolver").default() // loads resolver for "did:ethr"

class JwtService {

  async all() {
    l.info(`${this.constructor.name}.all()`);
    let all = await db.jwtAll()
    console.log(all)
    let result = all.map(j => ({id:j.id, issuedAt:j.issuedAt, subject:j.subject, claimType:j.claimType}))
    console.log(result)
    return result;
  }

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.jwtById(id);
  }

  jwtDecoded(encoded) {

    // this line is lifted from didJwt.verifyJWT
    const {payload, header, signature, data} = didJwt.decodeJWT(encoded)
    l.debug(payload, "payload")
    l.trace(header, "header")
    l.trace(signature, "signature")
    l.trace(data, "data")

    return {payload, header, signature, data}
  }

  create(encoded) {
    l.info(`${this.constructor.name}.create(ENCODED)`);
    l.trace(encoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(encoded)
    let entity = db.jwtEntity(encoded, payload)
    return db.jwtInsert(entity)
  }

  async createWithClaimRecords(encoded) {
    l.info(`${this.constructor.name}.createWithClaimRecords(ENCODED)`);
    l.trace(encoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(encoded)

    // this line is lifted from didJwt.verifyJWT
    const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
    l.debug(doc, "doc")
    l.trace(authenticators, "authenticators")
    l.trace(issuer, "issuer")

    let entity = db.jwtEntity(encoded, payload)
    let jwtId = await db.jwtInsert(entity)

    let DID = doc.id

    // this is the same as the doc.publicKey in my example
    //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

    if (payload.claim) {
      if (payload.claim['@context'] === 'http://schema.org'
          && payload.claim['@type'] === 'AttendedAction') {
        var eventId = await db.eventIdByNameTime(payload.claim.object.name, payload.claim.object.startTime)
        if (eventId === null) {
          eventId = await db.eventInsert(payload.claim.object.name, payload.claim.object.startTime)
          l.trace(`New event # ${eventId}`)
        }

        let attId = await db.attendanceInsert(DID, eventId)
        l.trace(`New attendance # ${attId}`)

      } else if (payload.claim['@context'] === 'http://endorser.ch'
                 && payload.claim['@type'] === 'ConfirmJwt') {
        let origPayload = JSON.parse(base64url.decode(payload.claim['payload']))
        l.debug(origPayload, "Original payload being confirmed")
        // someday: check whether this really is an AttendedAction
        var eventId = await db.eventIdByNameTime(origPayload.claim.object.name, origPayload.claim.object.startTime)
        if (eventId === null) throw Error("Attempted to confirm attendance at an unrecorded event.")
        let attendId = await db.attendanceIdByDidEvent(origPayload.claim.agent.did, eventId)
        if (attendId === null) throw Error("Attempted to confirm an unrecorded attendance.")
        db.endorsementInsert(DID, attendId)
      }
    }

    return jwtId
  }

}

export default new JwtService();
