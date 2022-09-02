import base64url from 'base64url'
import canonicalize from 'canonicalize'
import didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import R from 'ramda'
import util from 'util'

// I wish this was exposed in the did-jwt module!
import VerifierAlgorithm from '../../../node_modules/did-jwt/lib/VerifierAlgorithm'
import l from '../../common/logger'
import db from './endorser.db.service'
import { allDidsInside, calcBbox, hashChain, hashedClaimWithHashedDids, HIDDEN_TEXT } from './util';
import { addCanSee } from './network-cache.service'
// I couldn't figure out how to import this directly from the module.  Sheesh.
const resolveAuthenticator = require('./crypto/JWT').resolveAuthenticator

require("ethr-did-resolver").default() // loads resolver for "did:ethr"

// Determine if a claim has the right context, eg schema.org
//
// Different versions are because of "legacy context" issues.
//
// We still use this "http" since some have an old version of the app, but we expect to turn it off in late 2022.
// (It is also useful when we need to run scripts against that data.)
// Check with: select max(issuedAt) from jwt where claimContext = 'http://schema.org'
const isContextSchemaOrg = (context) => context === 'https://schema.org' || context === 'http://schema.org'
// ... and we only use the following for scripts.
// Check with: select max(issuedAt) from jwt where claimContext = 'http://endorser.ch'
//const isContextSchemaForConfirmation = (context) => isContextSchemaOrg(context) || context === 'http://endorser.ch' // latest was in 2020
//
// Here is what to use for new deployments, and for endorser.ch after all users have updated their apps.
//const isContextSchemaOrg = (context) => context === 'https://schema.org'
// Claims inside AgreeAction may not have a context if they're also in schema.org
const isContextSchemaForConfirmation = (context) => isContextSchemaOrg(context)

class JwtService {

  async byId(id, requesterDid) {
    l.trace(`${this.constructor.name}.byId(${id}, ${requesterDid})`);
    let jwtRec = await db.jwtById(id)
    if (jwtRec) {
      let result = {id:jwtRec.id, issuedAt:jwtRec.issuedAt, issuer:jwtRec.issuer, subject:jwtRec.subject, claimContext:jwtRec.claimContext, claimType:jwtRec.claimType, claim:JSON.parse(jwtRec.claim)}
      return result
    } else {
      return null
    }
  }

  async byQuery(params) {
    l.trace(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    var resultData
    resultData = await db.jwtsByParams(params)
    let result = resultData.map(j => {
      let thisOne = {id:j.id, issuer:j.issuer, issuedAt:j.issuedAt, subject:j.subject, claimContext:j.claimContext, claimType:j.claimType, claim:JSON.parse(j.claim)}
      return thisOne
    })
    return result
  }

  /**
   * Dangerous: this includes encoded data that might include private DIDs.
   */
  async fullJwtById(id, requesterDid) {
    l.trace(`${this.constructor.name}.fullJwtById(${id}, ${requesterDid})`);
    let jwtRec = await db.jwtById(id)
    if (jwtRec) {
      return jwtRec
    } else {
      return null
    }
  }

  async allClaimAndConfirmationIssuersMatchingClaimId(claimId) {
    let jwtClaim = await db.jwtById(claimId)
    if (!jwtClaim) {
      return []
    } else {
      let confirmations = await db.confirmationsByClaim(jwtClaim.claim)
      let allDids = R.append(
        jwtClaim.issuer,
        R.map((c)=>c.issuer, confirmations)
      )
      return R.uniq(allDids)
    }
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

  extractClaim(payload) {
    let claim = payload.claim
      || (payload.vc && payload.vc.credentialSubject)
    if (claim) {
      return claim;
    } else {
      throw Error("JWT payload must contain a 'claim' property or a 'vc' property with a 'credentialSubject'");
    }
  }

  /**
  create(jwtEncoded) {
    l.trace(`${this.constructor.name}.create(ENCODED)`);
    l.trace(jwtEncoded, "ENCODED")

    const {payload, header, signature, data} = this.jwtDecoded(jwtEncoded)
    let claimEncoded = base64url.encode(this.extractClaim(payload))
    let jwtEntity = db.buildJwtEntity(payload, ?, ?, claimEncoded, jwtEncoded)
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
              if (idAndClaim.hashHex === null) {
                l.error("Found entries without a hashed claim, indicating some problem when inserting jwt records. Will create.")
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
     @return object with: {confirmId: NUMBER, actionClaimId: NUMBER, orgRoleClaimId: NUMBER, tenureClaimId: NUMBER}
       ... where confirmId is -1 if something went wrong, and all others are optional
   **/
  async createOneConfirmation(jwtId, issuerDid, origClaim) {

    l.trace(`${this.constructor.name}.createOneConfirmation(${jwtId}, ${issuerDid}, ${util.inspect(origClaim)})`);

    // since AgreeAction is from schema.org, the embedded claim is the same by default
    if (origClaim['@context'] == null) {
      origClaim['@context'] = 'https://schema.org'
    }

    if (isContextSchemaOrg(origClaim['@context'])
        && origClaim['@type'] === 'JoinAction') {

      var events = await db.eventsByParams({orgName:origClaim.event.organizer.name, name:origClaim.event.name, startTime:origClaim.event.startTime})
      if (events.length === 0) return Promise.reject(new Error("Attempted to confirm action at an unrecorded event."))

      let actionClaimId = await db.actionClaimIdByDidEventId(origClaim.agent.did, events[0].id)
      if (actionClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded action."))

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndAction(issuerDid, actionClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm an action already confirmed in # ${confirmation.id}`))

      let origClaimStr = canonicalize(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, actionClaimId, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for actionClaimId ${actionClaimId}`);
      return {confirmId:result, actionClaimId}


    } else if (origClaim['@context'] === 'https://endorser.ch'
               && origClaim['@type'] === 'Tenure') {

      let tenureClaimId = await db.tenureClaimIdByPartyAndGeoShape(origClaim.party.did, origClaim.spatialUnit.geo.polygon)
      if (tenureClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded tenure."))

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndTenure(issuerDid, tenureClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm a tenure already confirmed in # ${confirmation.id}`))

      let origClaimStr = canonicalize(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, tenureClaimId, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for tenureClaimId ${tenureClaimId}`);
      return {confirmId:result, tenureClaimId}


    } else if (isContextSchemaOrg(origClaim['@context'])
               && origClaim['@type'] === 'Organization'
               && origClaim.member
               && origClaim.member['@type'] === 'OrganizationRole'
               && origClaim.member.member
               && origClaim.member.member.identifier) {

      let orgRoleClaimId = await db.orgRoleClaimIdByOrgAndDates(origClaim.name, origClaim.member.roleName, origClaim.member.startDate, origClaim.member.endDate, origClaim.member.member.identifier)
      if (orgRoleClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded orgRole."))

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndOrgRole(issuerDid, orgRoleClaimId)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm a orgRole already confirmed in # ${confirmation.id}`))

      let origClaimStr = canonicalize(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, null, orgRoleClaimId)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for orgRoleClaimId ${orgRoleClaimId}`);
      return {confirmId:result, orgRoleClaimId}


    } else {

      // check for duplicate
      let confirmation = await db.confirmationByIssuerAndOrigClaim(issuerDid, origClaim)
      if (confirmation !== null) return Promise.reject(new Error(`Attempted to confirm a claim already confirmed in # ${confirmation.id}`))

      let origClaimStr = canonicalize(origClaim)

      // If we choose to add the subject, it's found in these places (as of today):
      //   claim.agent.did
      //   claim.member.member.identifier
      //   claim.party.did
      //   claim.identifier

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for a generic confirmation`);
      return {confirmId:result}

    }
  }

  async createEmbeddedClaimRecord(jwtId, issuerDid, claim) {

    if (isContextSchemaOrg(claim['@context'])
        && claim['@type'] === 'AgreeAction') {

      l.trace('Adding AgreeAction confirmation', claim)
      // note that 'Confirmation' does similar logic (but is deprecated)

      let recordings = []
      {
        let origClaim = claim['object']
        if (Array.isArray(origClaim)) {
          // if we run these in parallel then there can be duplicates (when we haven't inserted previous ones in time for the duplicate check)
          for (var claim of origClaim) {
            recordings.push(await this.createOneConfirmation(jwtId, issuerDid, claim).catch(console.log))
          }
        } else if (origClaim) {
          recordings.push(await this.createOneConfirmation(jwtId, issuerDid, origClaim).catch(console.log))
        }
      }
      l.trace('Added confirmations', recordings)

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'JoinAction') {

      let agentDid = claim.agent.did
      if (!agentDid) {
        l.error(`Error in ${this.constructor.name}: JoinAction for ${jwtId} has no agent DID.`)
        return Promise.reject(new Error("Attempted to record a JoinAction claim with no agent DID."))
      }

      if (!claim.event) {
        l.error(`Error in ${this.constructor.name}: JoinAction for ${jwtId} has no event info.`)
        return Promise.reject(new Error("Attempted to record a JoinAction claim with no event info."))
      }

      var event
      var orgName = claim.event.organizer && claim.event.organizer.name
      var events = await db.eventsByParams({orgName:orgName, name:claim.event.name, startTime:claim.event.startTime})

      if (events.length === 0) {
        let eventId = await db.eventInsert(orgName, claim.event.name, claim.event.startTime)
        event = {id:eventId, orgName:orgName, name:claim.event.name, startTime:claim.event.startTime}
        l.trace(`${this.constructor.name} New event # ${util.inspect(event)}`)

      } else {
        event = events[0]
        if (events.length > 1) {
          l.warn(`${this.constructor.name} Multiple events exist with orgName ${orgName} name ${claim.event.name} startTime ${claim.event.startTime}`)
        }

        let actionClaimId = await db.actionClaimIdByDidEventId(agentDid, events[0].id)
        if (actionClaimId) return Promise.reject(new Error("Same user attempted to record an action claim that already exists with ID " + actionClaimId))

      }

      let actionId = await db.actionClaimInsert(issuerDid, agentDid, jwtId, event)
      l.trace(`${this.constructor.name} New action # ${actionId}`)


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Organization'
               && claim.member
               && claim.member['@type'] === 'OrganizationRole'
               && claim.member.member.identifier) {

      let entity = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        orgName: claim.name,
        roleName: claim.member.roleName,
        startDate: claim.member.startDate,
        endDate: claim.member.endDate,
        memberDid: claim.member.member.identifier
      }
      let orgRoleId = await db.orgRoleInsert(entity)


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'RegisterAction') {

      let registration = {
        did: claim.object,
        from: claim.agent,
        epoch: new Date().valueOf(),
        jwtId: jwtId,
      }

      let eventId = await db.registrationInsert(registration).catch(console.log)
      // currently assuming the only error is due to the unique constraint and we're OK if it's already there

    } else if (claim['@context'] === 'https://endorser.ch'
               && claim['@type'] === 'Tenure') {

      let bbox = calcBbox(claim.spatialUnit.geo.polygon)
      let entity =
          {
            jwtId: jwtId,
            issuerDid: issuerDid,
            partyDid: claim.party && claim.party.did,
            polygon: claim.spatialUnit.geo.polygon,
            westLon: bbox.westLon,
            minLat: bbox.minLat,
            eastLon: bbox.eastLon,
            maxLat: bbox.maxLat
          }

      let tenureId = await db.tenureInsert(entity)


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'VoteAction') {

      let vote = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        actionOption: claim.actionOption,
        candidate: claim.candidate,
        eventName: claim.object.event.name,
        eventStartTime: claim.object.event.startDate,
      }

      let eventId = await db.voteInsert(vote)


    } else if (isContextSchemaForConfirmation(claim['@context'])
               && claim['@type'] === 'Confirmation') {

      // this is for "legacy Confirmation" and can be deprecated; see AgreeAction

      var recordings = []

      { // handle a single claim
        let origClaim = claim['originalClaim']
        if (origClaim) {
          recordings.push(await this.createOneConfirmation(jwtId, issuerDid, origClaim).catch(console.log))
        }
      }

      { // handle multiple claims
        let origClaims = claim['originalClaims']
        if (origClaims) {
          // if we run these in parallel then there can be duplicates (when we haven't inserted previous ones in time for the duplicate check)
          for (var origClaim of origClaims) {
            recordings.push(await this.createOneConfirmation(jwtId, issuerDid, origClaim).catch(console.log))
          }
        }
      }
      l.trace(`${this.constructor.name} Created ${recordings.length} confirmations & network records.`, recordings)

      await Promise.all(recordings)
        .catch(err => {
          return Promise.reject(err)
        })


    } else {
      l.info("Submitted unknown claim type with @context " + claim['@context'] + " and @type " + claim['@type'] + "  This isn't a problem, it just means there is no dedicated storage or reporting for that type.")
    }

  }

  async createEmbeddedClaimRecords(jwtId, issuerDid, claim) {

    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(${jwtId}, ${issuerDid}, ...)`);
    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(..., ${util.inspect(claim)})`);

    if (Array.isArray(claim)) {

      var recordings = []
      { // handle multiple claims
        for (var subClaim of claim) {
          recordings.push(this.createEmbeddedClaimRecord(jwtId, issuerDid, subClaim))
        }
      }
      l.trace(`${this.constructor.name} creating ${recordings.length} claim records.`)

      await Promise.all(recordings)
        .catch(err => {
          return Promise.reject(err)
        })
    } else {
      await this.createEmbeddedClaimRecord(jwtId, issuerDid, claim)
      l.trace(`${this.constructor.name} created a claim record.`)
    }

    // now record all the "sees" relationships to the issuer
    var netRecords = []
    for (var did of allDidsInside(claim)) {
      netRecords.push(addCanSee(did, issuerDid))
    }
    await Promise.all(netRecords)
      .catch(err => {
        return Promise.reject(err)
      })

  }

  // return Promise of { payload, issuer, header }
  // ... and also if successful: signature, data, doc, authenticators
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

      /**
      // This is an alternate, attempted when we got the following error
      // which I believe was due to lack of a network connection.
      // "TypeError: Converting circular structure to JSON" (XMLHttpRequest)
      return resolveAuthenticator(header.alg, payload.iss, undefined).then(resolved => {
        const {doc, authenticators, issuer} = resolved
        return {payload, header, signature, data, doc, authenticators, issuer}
      }).catch((err) => {
        return Promise.reject('Error resolving JWT authenticator ' + err)
      })
      **/
    }
  }

  async createWithClaimRecord(jwtEncoded, authIssuerId) {
    l.trace(`${this.constructor.name}.createWithClaimRecord(ENCODED)`);
    l.trace(jwtEncoded, `${this.constructor.name} ENCODED`)
    const {payload, header, signature, data, doc, authenticators, issuer} =
        await this.decodeAndVerifyJwt(jwtEncoded)
        .catch((err) => {
          return Promise.reject(err)
        })

    if (payload.iss !== authIssuerId) {
      return Promise.reject(`JWT issuer ${authIssuerId} does not match claim issuer ${payload.iss}`)
    }

    const registered = await db.registrationByDid(payload.iss)
    if (!registered) {
      return Promise.reject(`Issuer ${payload.iss} is not registered. Contact an existing user for help.`)
    }

    const MAX_CLAIMS_PER_WEEK = 100
    const startOfWeek = DateTime.utc().startOf('week').toISODate()
    const claimedCount = await db.jwtCountByAfter(payload.iss, startOfWeek)
    if (claimedCount >= MAX_CLAIMS_PER_WEEK) {
      return Promise.reject(`Issuer ${payload.iss} has already claimed ${MAX_CLAIMS_PER_WEEK} this week. Contact an administrator for a higher limit`)
    }

    const payloadClaim = this.extractClaim(payload)
    if (payloadClaim) {
      const claimStr = canonicalize(payloadClaim)
      const claimEncoded = base64url.encode(claimStr)
      const jwtEntity = db.buildJwtEntity(payload, payloadClaim, claimStr, claimEncoded, jwtEncoded)
      const jwtRowId =
          await db.jwtInsert(jwtEntity)
          .catch((err) => {
            return Promise.reject(err)
          })

      //l.trace(doc, `${this.constructor.name} resolved doc`)
      //l.trace(authenticators, `${this.constructor.name} resolved authenticators`)
      //l.trace(issuer, `${this.constructor.name} resolved issuer`)

      const issuerDid = payload.iss

      // this is the same as the doc.publicKey in my example
      //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

      await this.createEmbeddedClaimRecords(jwtEntity.id, issuerDid, payloadClaim)
        .catch(err => {
          l.warn(err, `Failed to create embedded claim records.`)
        })

      // when adjusting this to an object with "success", include any failures from createEmbeddedClaimRecords
      return jwtEntity.id

    } else {
      l.warn(`${this.constructor.name} JWT received without a claim.`)
      return Promise.reject("JWT had no 'claim' property.")
    }
  }

}

export default new JwtService();
