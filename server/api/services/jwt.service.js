import l from '../../common/logger'
import base64url from 'base64url'
import util from 'util'
import db from './endorser.db.service'
import didJwt from 'did-jwt'
// I wish this was exposed in the did-jwt module!
import VerifierAlgorithm from '../../../node_modules/did-jwt/lib/VerifierAlgorithm'
// I couldn't figure out how to import this directly from the module.  Sheesh.
const resolveAuthenticator = require('./crypto/JWT').resolveAuthenticator

require("ethr-did-resolver").default() // loads resolver for "did:ethr"

class JwtService {

  byId(id) {
    l.info(`${this.constructor.name}.byId(${id})`);
    return db.jwtById(id);
  }

  async byQuery(params) {
    l.info(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    let resultData = await db.jwtByParams(params)
    let result = resultData.map(j => ({id:j.id, issuedAt:j.issuedAt, subject:j.subject, claimContext:j.claimContext, claimType:j.claimType, claimEncoded:j.claimEncoded}))
    return result;
  }

  jwtDecoded(encoded) {

    // this line is lifted from didJwt.verifyJWT
    const {payload, header, signature, data} = didJwt.decodeJWT(encoded)
    l.debug(payload, "decoded payload")
    l.trace(header, "decoded header")
    l.trace(signature, "decoded signature")
    l.trace(data, "decoded data")

    return {payload, header, signature, data}
  }

  /**
  create(jwtEncoded) {
    l.info(`${this.constructor.name}.create(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(jwtEncoded)
    let claimEncoded = base64url.encode(payload.claim)
    let jwtEntity = db.buildJwtEntity(payload, claimEncoded, jwtEncoded)
    return db.jwtInsert(jwtEntity)
  }
  **/

  async createEmbeddedClaimRecords(jwtId, issuerDid, claim) {

    if (claim['@context'] === 'http://schema.org'
        && claim['@type'] === 'JoinAction') {

      let agentDid = claim.agent.did

      var event
      var events = await db.eventsByParams({orgName:claim.event.organizer.name, name:claim.event.name, startTime:claim.event.startTime})
      if (events.length === 0) {
        let eventId = await db.eventInsert(claim.event.organizer.name, claim.event.name, claim.event.startTime)
        event = {id:eventId, orgName:claim.event.organizer.name, name:claim.event.name, startTime:claim.event.startTime}
        l.trace(`New event # ${util.inspect(event)}`)
      } else {
        event = events[0]
        if (events.length > 1) {
          l.warning(`Multiple events exist with orgName ${claim.event.organizer.name} name ${claim.event.name} startTime ${claim.event.startTime}`)
        }
      }

      let attId = await db.actionClaimInsert(agentDid, jwtId, event)
      l.trace(`New action # ${attId}`)

    } else if (claim['@context'] === 'http://endorser.ch'
               && claim['@type'] === 'Confirmation') {

      let origClaim = claim['originalClaim']
      l.debug(origClaim, "Original claim being confirmed")

      var events = await db.eventsByParams({orgName:origClaim.event.organizer.name, name:origClaim.event.name, startTime:origClaim.event.startTime})
      if (events.length === 0) throw Error("Attempted to confirm action at an unrecorded event.")

      let actionClaimId = await db.actionClaimIdByDidEventId(origClaim.agent.did, events[0].id)
      if (actionClaimId === null) throw Error("Attempted to confirm an unrecorded action.")

      let origClaimStr = JSON.stringify(origClaim)
      await db.confirmationInsert(issuerDid, jwtId, actionClaimId, origClaimStr)
    }
  }

  async createWithClaimRecord(jwtEncoded) {
    l.info(`${this.constructor.name}.createWithClaimRecord(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(jwtEncoded)
    if (payload.claim) {
      let claimEncoded = base64url.encode(JSON.stringify(payload.claim))
      let jwtEntity = db.buildJwtEntity(payload, claimEncoded, jwtEncoded)
      let jwtId = await db.jwtInsert(jwtEntity)

      // this line is lifted from didJwt.verifyJWT
      const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
      l.debug(doc, "resolved doc")
      l.trace(authenticators, "resolved authenticators")
      l.trace(issuer, "resolved issuer")

      let issuerDid = payload.iss

      // this is the same as the doc.publicKey in my example
      //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

      await this.createEmbeddedClaimRecords(jwtId, issuerDid, payload.claim)

      return jwtId

    } else {
      l.info("JWT received without a claim.")
      return -1 // not undefined because the jwt-controller looks at r.id... how does that even work?
    }
  }

  async createMultipleWithClaimRecords(jwtEncoded) {
    l.info(`${this.constructor.name}.createMultipleWithClaimRecords(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    l.warn("UNIMPLEMENTED")
    return -1
  }

}

export default new JwtService();
