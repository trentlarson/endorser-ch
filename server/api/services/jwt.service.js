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

  create(jwtEncoded) {
    l.info(`${this.constructor.name}.create(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(jwtEncoded)
    let claimEncoded = base64url.encode(payload.claim)
    let entity = db.buildJwtEntity(payload, claimEncoded, jwtEncoded)
    return db.jwtInsert(entity)
  }

  async createWithClaimRecord(jwtEncoded) {
    l.info(`${this.constructor.name}.createWithClaimRecords(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(jwtEncoded)
    let claimEncoded = base64url.encode(JSON.stringify(payload.claim))
    let entity = db.buildJwtEntity(payload, claimEncoded, jwtEncoded)
    let jwtId = await db.jwtInsert(entity)

    // this line is lifted from didJwt.verifyJWT
    const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
    l.debug(doc, "resolved doc")
    l.trace(authenticators, "resolved authenticators")
    l.trace(issuer, "resolved issuer")

    let DID = doc.id

    // this is the same as the doc.publicKey in my example
    //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

    if (payload.claim) {
      if (payload.claim['@context'] === 'http://schema.org'
          && payload.claim['@type'] === 'JoinAction') {

        // check that the subject is the same as the agent
        if (payload.sub !== payload.claim.agent.did) {
          throw new Error("Subject of JWT doesn't match JoinAction. sub:" + payload.sub + " agent DID:" + payload.claim.agent.did)
        }
        let agentDid = payload.claim.agent.did

        var event
        var events = await db.eventsByParams({orgName:payload.claim.event.organizer.name, name:payload.claim.event.name, startTime:payload.claim.event.startTime})
        if (events.length === 0) {
          let eventId = await db.eventInsert(payload.claim.event.organizer.name, payload.claim.event.name, payload.claim.event.startTime)
          event = {id:eventId, orgName:payload.claim.event.organizer.name, name:payload.claim.event.name, startTime:payload.claim.event.startTime}
          l.trace(`New event # ${util.inspect(event)}`)
        } else {
          event = events[0]
          if (events.length > 1) {
            l.warning(`Multiple events exist with orgName ${payload.claim.event.organizer.name} name ${payload.claim.event.name} startTime ${payload.claim.event.startTime}`)
          }
        }

        let attId = await db.actionClaimInsert(agentDid, jwtId, event, claimEncoded)
        l.trace(`New action # ${attId}`)

      } else if (payload.claim['@context'] === 'http://endorser.ch'
                 && payload.claim['@type'] === 'Confirmation') {

        let origClaimEncoded = payload.claim['claimEncoded']
        let origClaim = JSON.parse(base64url.decode(origClaimEncoded))
        l.debug(origClaim, "Original payload being confirmed")

        // someday: check whether this really is a JoinAction
        var events = await db.eventsByParams({orgName:origClaim.event.organizer.name, name:origClaim.event.name, startTime:origClaim.event.startTime})
        if (events.length === 0) throw Error("Attempted to confirm action at an unrecorded event.")
        let actionClaimId = await db.actionClaimIdByDidEventId(origClaim.agent.did, events[0].id)
        if (actionClaimId === null) throw Error("Attempted to confirm an unrecorded action.")
        await db.confirmationInsert(DID, jwtId, actionClaimId, origClaimEncoded)
      }
    }

    return jwtId
  }

}

export default new JwtService();
