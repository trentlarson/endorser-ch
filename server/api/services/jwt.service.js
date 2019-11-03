import l from '../../common/logger'
import base64url from 'base64url'
import util from 'util'
import didJwt from 'did-jwt'
import R from 'ramda'
import db from './endorser.db.service'
import { allDidsInside, calcBbox, hashChain, hashedClaimWithHashedDids, HIDDEN_TEXT } from './util';
// I wish this was exposed in the did-jwt module!
import VerifierAlgorithm from '../../../node_modules/did-jwt/lib/VerifierAlgorithm'
import { addCanSee } from './network-cache.service'
// I couldn't figure out how to import this directly from the module.  Sheesh.
const resolveAuthenticator = require('./crypto/JWT').resolveAuthenticator

require("ethr-did-resolver").default() // loads resolver for "did:ethr"

class JwtService {

  async byId(id, requesterDid) {
    l.info(`${this.constructor.name}.byId(${id}, ${requesterDid})`);
    return db.jwtById(id)
  }

  async byQuery(params, requesterDid) {
    l.info(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    var resultData
    if (params.claimContents) {
      resultData = await db.jwtByContent(params.claimContents)
    } else {
      resultData = await db.jwtByParams(params)
    }
    let result = resultData.map(j => {
      let thisOne = {id:j.id, issuedAt:j.issuedAt, subject:j.subject, claimContext:j.claimContext, claimType:j.claimType, claim:JSON.parse(j.claim)}
      return thisOne
    })
    return result
  }

  jwtDecoded(encoded) {

    // this line is lifted from didJwt.verifyJWT
    const {payload, header, signature, data} = didJwt.decodeJWT(encoded)
    l.trace(payload, `${this.constructor.name} decoded payload`)
    l.trace(header, `${this.constructor.name} decoded header`)
    l.trace(signature, `${this.constructor.name} decoded signature`)
    l.trace(data, `${this.constructor.name} decoded data`)

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

  async merkleUnmerkled() {
    return db.jwtClaimsAndIdsUnmerkled()
      .then(idAndClaimArray => {
        return db.jwtLastMerkleHash()
          .then(hashHexArray => {
            var seedHex = ""
            if (hashHexArray.length > 0) {
              seedHex = hashHexArray[0].hashChainHex
            }
            var updates = []
            var latestHashChainHex = seedHex
            for (let idAndClaim of idAndClaimArray) {
              latestHashChainHex = hashChain(latestHashChainHex, [idAndClaim])
              // Note that we can remove the claim hashHex update once all historical hashes are updated. (... in multiple places)
              if (idAndClaim.hashHex === null) {
                idAndClaim.hashHex = hashedClaimWithHashedDids(idAndClaim)
              }
              updates.push(db.jwtSetMerkleHash(idAndClaim.id, idAndClaim.hashHex, latestHashChainHex))
            }
            return Promise.all(updates)
          })
          .catch(e => {
            l.error(e, "Got error while saving hashes, with this toString(): " + e)
            return Promise.reject(e)
          })
      })
      .catch(e => {
        l.error(e, "Got error while retrieving unchained claims, with this toString(): " + e)
        return Promise.reject(e)
      })
  }

  /**
     @return object with: {newId:NUMBER, actionClaimRowId:NUMBER}
       ... where newId is -1 if something went wrong
   **/
  async createOneConfirmation(jwtId, issuerDid, origClaim) {

    l.debug(`${this.constructor.name}.createOneConfirmation(${jwtId}, ${issuerDid}, ${util.inspect(origClaim)})`);

    if (origClaim['@context'] === 'http://schema.org'
        && origClaim['@type'] === 'JoinAction') {

      var events = await db.eventsByParams({orgName:origClaim.event.organizer.name, name:origClaim.event.name, startTime:origClaim.event.startTime})
      if (events.length === 0) return Promise.reject(new Error("Attempted to confirm action at an unrecorded event."))

      let actionClaimId = await db.actionClaimIdByDidEventId(origClaim.agent.did, events[0].id)
      if (actionClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded action."))

      let confirmation = await db.confirmationByIssuerAndAction(issuerDid, actionClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm an action already confirmed in # ${confirmation.id}`))

      let origClaimStr = JSON.stringify(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, actionClaimId, null, null)
      l.debug(`${this.constructor.name}.createOneConfirmation # ${result} added for ${actionClaimId}`);
      return {newId:result, actionClaimId}

    } else if (origClaim['@context'] === 'http://endorser.ch'
               && origClaim['@type'] === 'Tenure') {

      let tenureClaimId = await db.tenureClaimIdByPartyAndGeoShape(origClaim.party.did, origClaim.spatialUnit.geo.polygon)
      if (tenureClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded tenure."))

      let confirmation = await db.confirmationByIssuerAndTenure(issuerDid, tenureClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm a tenure already confirmed in # ${confirmation.id}`))

      let origClaimStr = JSON.stringify(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, tenureClaimId, null)
      l.debug(`${this.constructor.name}.createOneConfirmation # ${result} added for ${tenureClaimId}`);
      return {newId:result, tenureClaimId}

    } else if (origClaim['@context'] === 'http://schema.org'
               && origClaim['@type'] === 'Organization'
               && origClaim['@type'] === 'Organization'
               && origClaim.member
               && origClaim.member['@type'] === 'OrganizationRole'
               && origClaim.member.member
               && origClaim.member.member.identifier) {

      let orgRoleClaimId = await db.orgRoleClaimIdByOrgAndDates(origClaim.name, origClaim.member.roleName, origClaim.member.startDate, origClaim.member.endDate, origClaim.member.member.identifier)
      if (orgRoleClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded orgRole."))

      let confirmation = await db.confirmationByIssuerAndOrgRole(issuerDid, orgRoleClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm a orgRole already confirmed in # ${confirmation.id}`))

      let origClaimStr = JSON.stringify(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, null, orgRoleClaimId)
      l.debug(`${this.constructor.name}.createOneConfirmation # ${result} added for ${orgRoleClaimId}`);
      return {newId:result, orgRoleClaimId}

    } else {
      l.warn("Attempted to confirm unknown claim with @context " + origClaim['@context'] + " and @type " + origClaim['@type'])
      return {}
    }
  }

  /**
     Take a claim being confirmed by an issuer, and create network records from all targeted people to that issuer

     @param actionClaimId is the claim being confirmed
     @param actionClaimAgentDid is the agent of that claim
     @param issuerDid is the issuer confirming it
     @return array of promises for all the insertions into the network table
   **/
  async createNetworkRecords(agentOrPartyDid, issuerDid) {
    // put the issuer in the confirmed claim-agent's network
    l.trace(`Adding network entry from ${agentOrPartyDid} to ${issuerDid}`)
    return addCanSee(agentOrPartyDid, issuerDid)
  }

  async createEmbeddedClaimRecord(jwtId, issuerDid, claim) {

    if (claim['@context'] === 'http://schema.org'
        && claim['@type'] === 'JoinAction') {

      let agentDid = claim.agent.did
      if (!agentDid) {
        l.error(`Error in ${this.constructor.name}: JoinAction for ${jwtId} has no agent DID.`)
        return Promise.reject(new Error("Attempted to record a JoinAction claim with no agent DID."))
      }

      var event
      var events = await db.eventsByParams({orgName:claim.event.organizer.name, name:claim.event.name, startTime:claim.event.startTime})
      if (events.length === 0) {
        let eventId = await db.eventInsert(claim.event.organizer.name, claim.event.name, claim.event.startTime)
        event = {id:eventId, orgName:claim.event.organizer.name, name:claim.event.name, startTime:claim.event.startTime}
        l.trace(`${this.constructor.name} New event # ${util.inspect(event)}`)

      } else {
        event = events[0]
        if (events.length > 1) {
          l.warning(`${this.constructor.name} Multiple events exist with orgName ${claim.event.organizer.name} name ${claim.event.name} startTime ${claim.event.startTime}`)
        }

        let actionClaimId = await db.actionClaimIdByDidEventId(agentDid, events[0].id)
        if (actionClaimId) return Promise.reject(new Error("Attempted to record an action claim that already exists with ID " + actionClaimId))

      }

      let actionId = await db.actionClaimInsert(issuerDid, agentDid, jwtId, event)
      l.trace(`${this.constructor.name} New action # ${actionId}`)

    } else if (claim['@context'] === 'http://schema.org'
               && claim['@type'] === 'Organization'
               && claim.member
               && claim.member['@type'] === 'OrganizationRole'
               && claim.member.member.identifier) {

      let entity = {
        jwtRowId: jwtId,
        issuerDid: issuerDid,
        orgName: claim.name,
        roleName: claim.member.roleName,
        startDate: claim.member.startDate,
        endDate: claim.member.endDate,
        memberDid: claim.member.member.identifier
      }
      let orgRoleId = await db.orgRoleInsert(entity)


    } else if (claim['@context'] === 'http://endorser.ch'
               && claim['@type'] === 'Tenure') {

      let bbox = calcBbox(claim.spatialUnit.geo.polygon)
      let entity =
          {
            jwtRowId: jwtId,
            issuerDid: issuerDid,
            partyDid: claim.party && claim.party.did,
            polygon: claim.spatialUnit.geo.polygon,
            westLon: bbox.westLon,
            minLat: bbox.minLat,
            eastLon: bbox.eastLon,
            maxLat: bbox.maxLat
          }

      let tenureId = await db.tenureInsert(entity)

    } else if (claim['@context'] === 'http://endorser.ch'
               && claim['@type'] === 'Confirmation') {

      var recordings = []

      { // handle a single claim
        let origClaim = claim['originalClaim']
        if (origClaim) {
          recordings.push(this.createOneConfirmation(jwtId, issuerDid, origClaim))
        }
      }

      { // handle multiple claims
        let origClaims = claim['originalClaims']
        if (origClaims) {
          for (var origClaim of origClaims) {
            recordings.push(this.createOneConfirmation(jwtId, issuerDid, origClaim))
          }
        }
      }
      l.debug(`${this.constructor.name} Created ${recordings.length} confirmations & network records.`)

      await Promise.all(recordings)
        .catch(err => {
          return Promise.reject(err)
        })

    } else if (claim['@context'] === 'http://schema.org'
               && claim['@type'] === 'VoteAction') {

      let vote = {
        jwtRowId: jwtId,
        issuerDid: issuerDid,
        actionOption: claim.actionOption,
        candidate: claim.candidate,
        eventName: claim.object.event.name,
        eventStartTime: claim.object.event.startDate,
      }

      let eventId = await db.voteInsert(vote)

    } else {
      l.warn("Submitted unknown claim type with @context " + claim['@context'] + " and @type " + claim['@type'] + "  This isn't a problem, it just means there is no dedicated storage or reporting for that type.")
    }

  }

  async createEmbeddedClaimRecords(jwtId, issuerDid, claim) {

    l.info(`${this.constructor.name}.createEmbeddedClaimRecords(${jwtId}, ${issuerDid}, ...)`);
    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(..., ${util.inspect(claim)})`);

    if (Array.isArray(claim)) {

      var recordings = []
      { // handle multiple claims
        for (var subClaim of claim) {
          recordings.push(this.createEmbeddedClaimRecord(jwtId, issuerDid, subClaim))
        }
      }
      l.debug(`${this.constructor.name} creating ${recordings.length} claim records.`)

      await Promise.all(recordings)
        .catch(err => {
          return Promise.reject(err)
        })
    } else {
      this.createEmbeddedClaimRecord(jwtId, issuerDid, claim)
    }

    // now record all the "sees" relationships to the issuer
    var netRecords = []
    for (var did of allDidsInside(claim)) {
      netRecords.push(this.createNetworkRecords(did, issuerDid))
    }
    await Promise.all(netRecords)
      .catch(err => {
        return Promise.reject(err)
      })

  }

  async decodeAndVerifyJwt(jwt) {
    if (process.env.NODE_ENV === 'test-local') {
      // This often yields the following error message if the JWT is malformed: "TypeError: Cannot read property 'toString' of undefined"
      let payload = JSON.parse(base64url.decode(R.split('.', jwt)[1]))
      let nowEpoch =  Math.floor(new Date().getTime() / 1000)
      if (payload.exp < nowEpoch) {
        l.warn("JWT with exp " + payload.exp + " has expired but we're in test mode so using a new time." )
        payload.exp = nowEpoch + 100
      }
      return {payload, issuer: payload.iss, header: {typ: "test"}} // all the other elements will be undefined, obviously
    } else {
      const {payload, header, signature, data} = this.jwtDecoded(jwt)
      // this line is lifted from didJwt.verifyJWT
      const {doc, authenticators, issuer} = await resolveAuthenticator(header.alg, payload.iss, undefined)
      return {payload, header, signature, data, doc, authenticators, issuer}
    }
  }

  async createWithClaimRecord(jwtEncoded, authIssuerId) {
    l.info(`${this.constructor.name}.createWithClaimRecord(ENCODED)`);
    l.trace(jwtEncoded, `${this.constructor.name} ENCODED`)

    let {payload, header, signature, data, doc, authenticators, issuer} =
        await this.decodeAndVerifyJwt(jwtEncoded)
        .catch((err) => {
          return Promise.reject(err)
        })

    if (payload.iss && (payload.iss !== authIssuerId)) {
      return Promise.reject(`JWT issuer ${authIssuerId} does not match claim iss ${payload.iss}`)
    }

    if (payload.claim) {
      let claimStr = JSON.stringify(payload.claim)
      let claimEncoded = base64url.encode(claimStr)
      let jwtEntity = db.buildJwtEntity(payload, claimStr, claimEncoded, jwtEncoded)
      let jwtId =
          await db.jwtInsert(jwtEntity)
          .catch((err) => {
            return Promise.reject(err)
          })

      let savedJwt = await db.jwtById(jwtId)
      await db.jwtSetHash(jwtId, hashedClaimWithHashedDids({id:jwtId, claim:claimStr}))

      //l.debug(doc, `${this.constructor.name} resolved doc`)
      //l.trace(authenticators, `${this.constructor.name} resolved authenticators`)
      //l.trace(issuer, `${this.constructor.name} resolved issuer`)

      let issuerDid = payload.iss

      // this is the same as the doc.publicKey in my example
      //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

      await this.createEmbeddedClaimRecords(jwtId, issuerDid, payload.claim)
        .catch(err => {
          l.warn(err, `Failed to create embedded claim records.`)
        })

      // when adjusting this to an object with "success", include any failures from createEmbeddedClaimRecords
      return jwtId

    } else {
      l.warn(`${this.constructor.name} JWT received without a claim.`)
      return Promise.reject("JWT had no 'claim' property.")
    }
  }

}

export default new JwtService();
