import base64url from 'base64url'
import canonicalize from 'canonicalize'
import didJwt from 'did-jwt'
import { Resolver } from 'did-resolver'
import { DateTime } from 'luxon'
import R from 'ramda'
import util from 'util'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'

import l from '../../common/logger'
import db from './endorser.db.service'
import {
  allDidsInside, calcBbox, ERROR_CODES, GLOBAL_ENTITY_ID_IRI_PREFIX,
  hashChain, isDid, isGlobalUri, hashedClaimWithHashedDids, HIDDEN_TEXT,
} from './util';
import { addCanSee } from './network-cache.service'

// for did-jwt 6.8.0 & ethr-did-resolver 6.2.2
const resolver = new Resolver({...ethrDidResolver({infuraProjectId: process.env.INFURA_PROJECT_ID || 'fake-infura-project-id'})})

const SERVICE_ID = process.env.SERVICE_ID

const DEFAULT_MAX_REGISTRATIONS_PER_MONTH = process.env.DEFAULT_MAX_REGISTRATIONS_PER_MONTH || 10
const DEFAULT_MAX_CLAIMS_PER_WEEK = process.env.DEFAULT_MAX_CLAIMS_PER_WEEK || 100

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

const isEndorserRegistrationClaim = (claim) =>
      isContextSchemaOrg(claim['@context'])
      && claim['@type'] === 'RegisterAction'
      && claim['object'] === SERVICE_ID

const globalFromInternalIdentifier = (id) => GLOBAL_ENTITY_ID_IRI_PREFIX + id

class ClaimService {

  async byId(id, requesterDid) {
    l.trace(`${this.constructor.name}.byId(${id}, ${requesterDid})`);
    let jwtRec = await db.jwtById(id)
    if (jwtRec) {
      let result = {id:jwtRec.id, issuedAt:jwtRec.issuedAt, issuer:jwtRec.issuer, subject:jwtRec.subject,
                    claimContext:jwtRec.claimContext, claimType:jwtRec.claimType, claim:JSON.parse(jwtRec.claim),
                    handleId:jwtRec.handleId}
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
      let thisOne = {id:j.id, issuer:j.issuer, issuedAt:j.issuedAt, subject:j.subject, claimContext:j.claimContext,
                     claimType:j.claimType, claim:JSON.parse(j.claim), handleId:j.handleId}
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

  async thisClaimAndConfirmationsIssuersMatchingClaimId(claimId) {
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

  async getRateLimits(requestorDid) {
    const registered = await db.registrationByDid(requestorDid)
    if (registered) {
      const startOfMonthDate = DateTime.utc().startOf('month')
      const startOfMonthEpoch = Math.floor(startOfMonthDate.valueOf() / 1000)
      const startOfWeekDate = DateTime.utc().startOf('week') // luxon weeks start on Mondays
      const startOfWeekString = startOfWeekDate.toISO()
      const result = {
        nextMonthBeginDateTime: startOfMonthDate.plus({months: 1}).toISO(),
        nextWeekBeginDateTime: startOfWeekDate.plus({weeks: 1}).toISO(),
      }

      const claimedCount = await db.jwtCountByAfter(requestorDid, startOfWeekString)
      result.doneClaimsThisWeek = claimedCount

      const regCount = await db.registrationCountByAfter(requestorDid, startOfMonthEpoch)
      result.doneRegistrationsThisMonth = regCount
      result.maxClaimsPerWeek = registered.maxClaims || DEFAULT_MAX_CLAIMS_PER_WEEK
      result.maxRegistrationsPerMonth = registered.maxRegs || DEFAULT_MAX_REGISTRATIONS_PER_MONTH
      return result
    } else {
      return Promise.reject({
        clientError: { message: 'Rate limits are only available to existing users.',
                       code: ERROR_CODES.UNREGISTERED_USER }
      })
    }
  }

  extractClaim(payload) {
    let claim = payload.claim
      || (payload.vc && payload.vc.credentialSubject)
    if (claim) {
      return claim
    } else {
      return null
    }
  }

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
                l.error(
                  "Found entries without a hashed claim, indicating some problem when inserting jwt records."
                    + " Will create."
                )
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

      var events = await db.eventsByParams(
        {orgName:origClaim.event.organizer.name, name:origClaim.event.name, startTime:origClaim.event.startTime}
      )
      if (events.length === 0) {
        return Promise.reject(new Error("Attempted to confirm action at an unrecorded event."))
      }

      // agent.did is for legacy data, some still in mobile app
      let agentDid = origClaim.agent?.identifier || origClaim.agent?.did

      let actionClaimId = await db.actionClaimIdByDidEventId(agentDid, events[0].id)
      if (actionClaimId === null) {
        return Promise.reject(new Error("Attempted to confirm an unrecorded action."))
      }

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndAction(issuerDid, actionClaimId)
      if (confirmation !== null) {
        return Promise.reject(new Error(`Attempted to confirm an action already confirmed in # ${confirmation.id}`))
      }

      let origClaimStr = canonicalize(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, actionClaimId, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for actionClaimId ${actionClaimId}`);
      return {confirmId:result, actionClaimId}


    } else if (origClaim['@context'] === 'https://endorser.ch'
               && origClaim['@type'] === 'Tenure') {

      // party.did is for legacy data, some still in mobile app
      let partyDid = origClaim.party?.identifier || origClaim.party?.did

      let tenureClaimId = await db.tenureClaimIdByPartyAndGeoShape(partyDid, origClaim.spatialUnit.geo.polygon)
      if (tenureClaimId === null) {
        return Promise.reject(new Error("Attempted to confirm an unrecorded tenure."))
      }

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndTenure(issuerDid, tenureClaimId)
      if (confirmation !== null) {
        return Promise.reject(new Error(`Attempted to confirm a tenure already confirmed in # ${confirmation.id}`))
      }

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

      let orgRoleClaimId =
          await db.orgRoleClaimIdByOrgAndDates(
            origClaim.name, origClaim.member.roleName, origClaim.member.startDate,
            origClaim.member.endDate, origClaim.member.member.identifier
          )
      if (orgRoleClaimId === null) return Promise.reject(new Error("Attempted to confirm an unrecorded orgRole."))

      // check for duplicate
      // this can be replaced by confirmationByIssuerAndOrigClaim
      let confirmation = await db.confirmationByIssuerAndOrgRole(issuerDid, orgRoleClaimId)
      if (confirmation !== null) {
        return Promise.reject(new Error(`Attempted to confirm a orgRole already confirmed in # ${confirmation.id}`))
      }

      let origClaimStr = canonicalize(origClaim)

      let result = await db.confirmationInsert(issuerDid, jwtId, origClaimStr, null, null, orgRoleClaimId)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added for orgRoleClaimId ${orgRoleClaimId}`);
      return {confirmId:result, orgRoleClaimId}


    } else {

      // check for duplicate
      let confirmation = await db.confirmationByIssuerAndOrigClaim(issuerDid, origClaim)
      if (confirmation !== null) {
        return Promise.reject(new Error(`Attempted to confirm a claim already confirmed in # ${confirmation.id}`))
      }

      let origClaimStr = canonicalize(origClaim)

      // If we choose to add the subject, it's found in these places (as of today):
      //   claim.[ agent | member.member | party | participant ].identifier
      //
      //   The "did" version is for legacy data, maybe still in mobile app.
      //   claim.[ agent | member.member | party | participant ].did

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
          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (var claim of origClaim) {
            recordings.push(await this.createOneConfirmation(jwtId, issuerDid, claim).catch(console.log))
          }
        } else if (origClaim) {
          recordings.push(await this.createOneConfirmation(jwtId, issuerDid, origClaim).catch(console.log))
        }
      }
      l.trace('Added confirmations', recordings)
      let confirmations = await recordings
      return { confirmations }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'JoinAction') {

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

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
          l.warn(
            `${this.constructor.name} Multiple events exist with orgName ${orgName} name ${claim.event.name}`
            + ` startTime ${claim.event.startTime}`)
        }

        let actionClaimId = await db.actionClaimIdByDidEventId(agentDid, events[0].id)
        if (actionClaimId) {
          return Promise.reject(
            new Error("Same user attempted to record an action claim that already exists with ID "
                      + actionClaimId)
          )
        }

      }

      let actionId = await db.actionClaimInsert(issuerDid, agentDid, jwtId, event)
      l.trace(`${this.constructor.name} New action # ${actionId}`)
      return { actionId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Organization'
               && claim.member
               && claim.member['@type'] === 'OrganizationRole'
               && claim.member.member.identifier) {

      let entry = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        orgName: claim.name,
        roleName: claim.member.roleName,
        startDate: claim.member.startDate,
        endDate: claim.member.endDate,
        memberDid: claim.member.member.identifier
      }
      let orgRoleId = await db.orgRoleInsert(entry)
      return { orgRoleId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'PlanAction') {

      // note that this is similar to Project

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      let internalId = null
      let fullIri = null
      let planRecord = null
      let clientMessage = null
      if (claim.identifier == null) {
        internalId = jwtId
        fullIri = GLOBAL_ENTITY_ID_IRI_PREFIX + internalId
      } else {
        if (isGlobalUri(claim.identifier)) {
          if (claim.identifier.startsWith(GLOBAL_ENTITY_ID_IRI_PREFIX)) {
            // It should already exist.
            planRecord = await db.planInfoByFullIri(claim.identifier)
            if (planRecord == null) {
              clientMessage = 'You are not allowed to use an identifier that does not already exist.'
                + ' This will not be saved as a valid plan.'
            } else {
              // Found an existing record.
              internalId = planRecord.internalId
              fullIri = planRecord.fullIri
            }
          } else {
            fullIri = claim.identifier

            // It is an IRI from some other system... fine.
            // It might already be in our system.
            planRecord = await db.planInfoByFullIri(fullIri)
            if (planRecord == null) {
              internalId = jwtId
            } else {
              internalId = planRecord.internalId
            }
          }

        } else {
          // It is not a global IRI.
          planRecord =
            await db.planInfoByFullIri(GLOBAL_ENTITY_ID_IRI_PREFIX + claim.identifier)

          if (planRecord == null) {
            clientMessage = 'You are not allowed to use an identifier that does not exist yet.'
              + ' This will not be saved as a valid plan.'
          } else {
            internalId = planRecord.internalId
            fullIri = planRecord.fullIri
          }
        }
      }

      // insert or edit

      if (fullIri == null || internalId == null) {
        // this is not valid for storing in our system
        return { clientMessage }
      } else {
        // this is valid for our system

        const entry = {
          jwtId: jwtId,
          agentDid: agentDid,
          issuerDid: issuerDid,
          fullIri: fullIri,
          internalId: internalId,
          name: claim.name,
          description: claim.description,
          image: claim.image,
          endTime: claim.endTime,
          startTime: claim.startDate,
          resultDescription: claim.resultDescription,
          resultIdentifier: claim.resultIdentifier,
        }

        if (planRecord == null) {
          // new record
          const planId = await db.planInsert(entry)
          return { clientMessage, fullIri, internalId, recordsSavedForEdit: 1 }

        } else {
          // edit that record
          if (issuerDid == planRecord.issuerDid
              || issuerDid == planRecord.agentDid) {
            const numUpdated = await db.planUpdate(entry)

            if (clientMessage != null) {
              return { clientMessage, fullIri, internalId, recordsSavedForEdit: numUpdated }
            }
          } else {
            // don't edit because they're not the issuer or agent
            return { clientMessage: 'you are not the issuer or agent of the original record.'
                     + ' This was not stored as a valid plan.' }
          }
        }
      }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Project') {

      // note that this is similar to PlanAction

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      let internalId = null
      let fullIri = null
      let projectRecord = null
      let clientMessage = null
      if (claim.identifier == null) {
        internalId = jwtId
        fullIri = GLOBAL_ENTITY_ID_IRI_PREFIX + internalId
      } else {
        if (isGlobalUri(claim.identifier)) {
          if (claim.identifier.startsWith(GLOBAL_ENTITY_ID_IRI_PREFIX)) {
            // It should already exist.
            projectRecord = await db.projectInfoByFullIri(claim.identifier)
            if (projectRecord == null) {
              clientMessage = 'You are not allowed to use an identifier that does not already exist.'
                + ' This will not be saved as a valid project.'
            } else {
              // Found an existing record.
              internalId = projectRecord.internalId
              fullIri = projectRecord.fullIri
            }
          } else {
            fullIri = claim.identifier

            // It is an IRI from some other system... fine.
            // It might already be in our system.
            projectRecord = await db.projectInfoByFullIri(fullIri)
            if (projectRecord == null) {
              internalId = jwtId
            } else {
              internalId = projectRecord.internalId
            }
          }

        } else {
          // It is not a global IRI.
          projectRecord =
            await db.projectInfoByFullIri(GLOBAL_ENTITY_ID_IRI_PREFIX + claim.identifier)

          if (projectRecord == null) {
            clientMessage = 'You are not allowed to use an identifier that does not exist yet.'
              + ' This will not be saved as a valid project.'
          } else {
            internalId = projectRecord.internalId
            fullIri = projectRecord.fullIri
          }
        }
      }

      // insert or edit

      if (fullIri == null || internalId == null) {
        // this is not valid for storing in our system
        return { clientMessage }
      } else {
        // this is valid for our system

        const entry = {
          jwtId: jwtId,
          agentDid: agentDid,
          issuerDid: issuerDid,
          fullIri: fullIri,
          internalId: internalId,
          name: claim.name,
          description: claim.description,
          image: claim.image,
          endTime: claim.endTime,
          startTime: claim.startDate,
          resultDescription: claim.resultDescription,
          resultIdentifier: claim.resultIdentifier,
        }

        if (projectRecord == null) {
          // new record
          const projectId = await db.projectInsert(entry)
          return { clientMessage, fullIri, internalId, recordsSavedForEdit: 1 }

        } else {
          // edit that record
          if (issuerDid == projectRecord.issuerDid
              || issuerDid == projectRecord.agentDid) {
            const numUpdated = await db.projectUpdate(entry)

            if (clientMessage != null) {
              return { clientMessage, fullIri, internalId, recordsSavedForEdit: numUpdated }
            }
          } else {
            // don't edit because they're not the issuer or agent
            return { clientMessage: 'you are not the issuer or agent of the original record.'
                     + ' This was not stored as a valid project.' }
          }
        }
      }

    } else if (isEndorserRegistrationClaim(claim)) {

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      // participant.did is for legacy data, some still in the mobile app
      let participantDid = claim.participant?.identifier || claim.participant?.did

      let registration = {
        did: participantDid,
        agent: agentDid,
        epoch: Math.floor(new Date().valueOf() / 1000),
        jwtId: jwtId,
      }

      let registrationId = await db.registrationInsert(registration)
      return { registrationId }

    } else if (claim['@context'] === 'https://endorser.ch'
               && claim['@type'] === 'Tenure') {

      // party.did is for legacy data, some still in the mobile app
      let partyDid = claim.party?.identifier || claim.party?.did

      let bbox = calcBbox(claim.spatialUnit.geo.polygon)
      let entry =
          {
            jwtId: jwtId,
            issuerDid: issuerDid,
            partyDid: partyDid,
            polygon: claim.spatialUnit.geo.polygon,
            westLon: bbox.westLon,
            minLat: bbox.minLat,
            eastLon: bbox.eastLon,
            maxLat: bbox.maxLat
          }

      let tenureId = await db.tenureInsert(entry)
      return { tenureId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'VoteAction') {

      let entry = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        actionOption: claim.actionOption,
        candidate: claim.candidate,
        eventName: claim.object.event.name,
        eventStartTime: claim.object.event.startDate,
      }

      let voteId = await db.voteInsert(entry)
      return { voteId }


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
          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (var origClaim of origClaims) {
            recordings.push(await this.createOneConfirmation(jwtId, issuerDid, origClaim).catch(console.log))
          }
        }
      }
      l.trace(`${this.constructor.name} Created ${recordings.length} confirmations & network records.`, recordings)

      let confirmations = await Promise.all(recordings)
      return { confirmations }

    } else {
      l.info("Submitted unknown claim type with @context " + claim['@context'] + " and @type " + claim['@type']
             + "  This isn't a problem, it just means there is no dedicated storage or reporting for that type.")

      return {}
    }

  }

  async createEmbeddedClaimRecords(jwtId, issuerDid, claim) {

    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(${jwtId}, ${issuerDid}, ...)`);
    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(..., ${util.inspect(claim)})`);

    let embeddedResults
    if (Array.isArray(claim)) {

      if (Array.isArray.payloadClaim
          && R.filter(c => c['@type'] === 'Project', claim).length > 1) {
        // To allow this, you'll have to assign different IDs to each project.
        return { clientError: 'Sending multiple Projects at once does not allow editing. Send individually.' }
      }

      var recordings = []
      { // handle multiple claims
        for (var subClaim of claim) {
          recordings.push(this.createEmbeddedClaimRecord(jwtId, issuerDid, subClaim))
        }
      }
      l.trace(`${this.constructor.name} creating ${recordings.length} claim records.`)

      embeddedResults = await Promise.all(recordings)
    } else {
      embeddedResults = await this.createEmbeddedClaimRecord(jwtId, issuerDid, claim)
      l.trace(`${this.constructor.name} created a claim record.`)
    }

    // now record all the "sees" relationships to the issuer
    var netRecords = []
    for (var did of allDidsInside(claim)) {
      netRecords.push(addCanSee(did, issuerDid))
    }
    // since addCanSee doesn't return anything, this is a list of nulls
    let allNetRecords = await Promise.all(netRecords)
        .catch(err => {
          return err
        })

    if (Array.isArray(embeddedResults)) {
      return { embeddedResults: embeddedResults, networkResult: allNetRecords }
    } else {
      return R.mergeLeft(embeddedResults, { networkResults: allNetRecords })
    }

  }

  // return Promise of at least { payload, header, issuer }
  // ... and also if successfully verified: data, doc, signature, signer
  async decodeAndVerifyJwt(jwt) {
    if (process.env.NODE_ENV === 'test-local') {
      // Error of "Cannot read property 'toString' of undefined" usually means the JWT is malformed
      // eg. no "." separators.
      let payload = JSON.parse(base64url.decode(R.split('.', jwt)[1]))
      let nowEpoch =  Math.floor(new Date().getTime() / 1000)
      if (payload.exp < nowEpoch) {
        l.warn("JWT with exp " + payload.exp + " has expired but we're in test mode so using a new time." )
        payload.exp = nowEpoch + 100
      }
      return {payload, issuer: payload.iss, header: {typ: "test"}} // all the other elements will be undefined
    } else {

      try {
        let verified = await didJwt.verifyJWT(jwt, { resolver })
        return verified

      } catch (e) {
        return Promise.reject({
          clientError: { message: `JWT failed verification: ` + e.toString(),
                         code: ERROR_CODES.JWT_VERIFY_FAILED }
        })
      }
    }
  }

  /**
     @param authIssuerId is the issuer if an Authorization Bearer JWT is sent

     @return object with:
     - id of claim
     - extra info for other created data, eg. planId if one was generated
   **/
  async createWithClaimRecord(jwtEncoded, authIssuerId) {
    l.trace(`${this.constructor.name}.createWithClaimRecord(ENCODED)`);
    l.trace(jwtEncoded, `${this.constructor.name} ENCODED`)

    // available: { didResolutionResult w/ didDocument, issuer, payload, policies, signer, verified }
    const { payload } =
        await this.decodeAndVerifyJwt(jwtEncoded)
        .catch((err) => {
          return Promise.reject(err)
        })

    if (authIssuerId && payload.iss !== authIssuerId) {
      return Promise.reject(`JWT issuer ${authIssuerId} does not match claim issuer ${payload.iss}`)
    }

    const registered = await db.registrationByDid(payload.iss)
    if (!registered) {
      return Promise.reject(
        { clientError: { message: `You are not registered to make claims. Contact an existing user for help.`,
                         code: ERROR_CODES.UNREGISTERED_USER }}
      )
    }

    const startOfWeekDate = DateTime.utc().startOf('week') // luxon weeks start on Mondays
    const startOfWeekString = startOfWeekDate.toISO()
    const claimedCount = await db.jwtCountByAfter(payload.iss, startOfWeekString)
    // 0 shouldn't mean DEFAULT
    const maxAllowedClaims = registered.maxClaims != null ? registered.maxClaims : DEFAULT_MAX_CLAIMS_PER_WEEK
    if (claimedCount >= maxAllowedClaims) {
      return Promise.reject(
        { clientError: { message: `You have already made ${maxAllowedClaims} claims this week.`
                         + ` Contact an administrator for a higher limit.`,
                         code: ERROR_CODES.OVER_CLAIM_LIMIT } }
      )
    }

    const payloadClaim = this.extractClaim(payload)
    if (payloadClaim) {
      if (isEndorserRegistrationClaim(payloadClaim)) {
        const startOfMonthDate = DateTime.utc().startOf('month')
        const startOfMonthEpoch = Math.floor(startOfMonthDate.valueOf() / 1000)
        const regCount = await db.registrationCountByAfter(payload.iss, startOfMonthEpoch)
        // 0 shouldn't mean DEFAULT
        const maxAllowedRegs = registered.maxRegs != null ? registered.maxRegs : DEFAULT_MAX_REGISTRATIONS_PER_MONTH
        if (regCount >= maxAllowedRegs) {
          return Promise.reject({ clientError: { message: `You have already registered ${maxAllowedRegs} this month.`
                                                 + ` Contact an administrator for a higher limit.`,
                                                 code: ERROR_CODES.OVER_REGISTRATION_LIMIT } }
                               )
        }

        const startOfWeekEpoch = Math.floor(startOfWeekDate.valueOf() / 1000)
        if (registered.epoch > startOfWeekEpoch) {
          return Promise.reject(
            { clientError: { message: `You cannot register others the same week you got registered.`,
                             code: ERROR_CODES.CANNOT_REGISTER_TOO_SOON } }
          )
        }
      }

      // Generate the local id and find or generate the global "entity" handle ID.
      let internalId = db.newUlid()
      let handleId
      // If this has an identifier, check the previous instance to see if they are allowed to edit.
      if (payloadClaim.identifier) { // 'identifier' is a schema.org convention; may add others
        handleId =
          isGlobalUri(payloadClaim.identifier)
          ? payloadClaim.identifier
          : globalFromInternalIdentifier(payloadClaim.identifier)
        const prevEntry = await db.jwtLastByHandleIdRaw(handleId)
        if (!prevEntry) {
          if (!isGlobalUri(payloadClaim.identifier)
              && payloadClaim.identifier?.length === 26) {
            // don't allow any non-global IDs that may clash with IDs
            return Promise.reject(
              { clientError: {
                message: `You cannot use a non-global-URI identifer you don't own that may clash with another ID.`
              } }
            )
          } else {
            // we're OK to continue, with the handle being either global or local and not potentially clashing
          }
        } else {
          if (payload.iss == prevEntry.issuer || payload.iss == handleId) {
            // The issuer is the same as the previous, or the issuer matches the global handle.
            // We're OK to continue.
          } else {
            const prevClaim = JSON.parse(prevEntry.claim)
            if (payload.iss == prevClaim.agent?.identifier) {
              // The issuer was assigned as an agent.
              // We're OK to continue.
            } else {
              // someday check other properties, eg 'member' in Organization (requiring a role check)
              return Promise.reject(
                { clientError: {
                  message: `You cannot use a non-global-URI identifier if you did not create the original.`
                } }
              )
            }
          }
        }
      } else {
        handleId = globalFromInternalIdentifier(internalId)
      }

      const claimStr = canonicalize(payloadClaim)
      const claimEncoded = base64url.encode(claimStr)
      const jwtEntry = db.buildJwtEntry(payload, internalId, handleId, payloadClaim, claimStr, claimEncoded, jwtEncoded)
      const jwtRowId =
          await db.jwtInsert(jwtEntry)
          .catch((err) => {
            return Promise.reject(err)
          })

      //l.trace(doc, `${this.constructor.name} resolved doc`)
      //l.trace(authenticators, `${this.constructor.name} resolved authenticators`)
      //l.trace(issuer, `${this.constructor.name} resolved issuer`)

      const issuerDid = payload.iss

      // this is the same as the doc.publicKey in my example
      //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

      let embedded = await this.createEmbeddedClaimRecords(jwtEntry.id, issuerDid, payloadClaim)
        .catch(err => {
          l.error(err, `Failed to create embedded claim records.`)
          return { embeddedRecordError: err }
        })

      const result = R.mergeLeft({ claimId: jwtEntry.id, handleId: handleId }, embedded)
      return result

    } else {
      l.warn(`${this.constructor.name} JWT received without a claim.`)
      return Promise.reject("JWT had no 'claim' property.")
    }
  }

}

export default new ClaimService();
