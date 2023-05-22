import base64url from 'base64url'
import canonicalize from 'canonicalize'
import didJwt from 'did-jwt'
import { Resolver } from 'did-resolver'
import { DateTime } from 'luxon'
import R from 'ramda'
import util from 'util'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'

import l from '../../common/logger'
import { dbService } from './endorser.db.service'
import {
  allDidsInside, calcBbox, ERROR_CODES, GLOBAL_ENTITY_ID_IRI_PREFIX,
  globalFromInternalIdentifier, globalId,
  hashChain, isDid, isGlobalUri, hashedClaimWithHashedDids, HIDDEN_TEXT,
} from './util';
import { addCanSee } from './network-cache.service'

// for did-jwt 6.8.0 & ethr-did-resolver 6.2.2
const resolver =
      new Resolver({
        ...ethrDidResolver({
          infuraProjectId: process.env.INFURA_PROJECT_ID || 'fake-infura-project-id'
        })
      })

const SERVICE_ID = process.env.SERVICE_ID

const DEFAULT_MAX_REGISTRATIONS_PER_MONTH =
      process.env.DEFAULT_MAX_REGISTRATIONS_PER_MONTH || 10
const DEFAULT_MAX_CLAIMS_PER_WEEK =
      process.env.DEFAULT_MAX_CLAIMS_PER_WEEK || 100

// Determine if a claim has the right context, eg schema.org
//
// Different versions are because of "legacy context" issues.
//
// We still use this "http" since some have an old version of the app,
// but we expect to turn it off in late 2022.
// (It is also useful when we need to run scripts against that data.)
// Verify: select max(issuedAt) from jwt where claimContext='http://schema.org'
const isContextSchemaOrg =
      (context) =>
      context === 'https://schema.org' || context === 'http://schema.org'
//
// ... and we only use the following for scripts.
// Verify: select max(issuedAt) from jwt where claimContext='http://endorser.ch'
// Latest was in 2020
//const isContextSchemaForConfirmation =
//    (context) =>
//    isContextSchemaOrg(context) || context === 'http://endorser.ch'
//
// Here is what to use for new deployments, and for endorser.ch after all users
// have updated their apps.
//const isContextSchemaOrg = (context) => context === 'https://schema.org'
// Claims inside AgreeAction may not have context if they're also in schema.org
const isContextSchemaForConfirmation = (context) => isContextSchemaOrg(context)

const isEndorserRegistrationClaim = (claim) =>
      isContextSchemaOrg(claim['@context'])
      && claim['@type'] === 'RegisterAction'
      && claim['object'] === SERVICE_ID

class ClaimService {

  async byId(id, requesterDid) {
    l.trace(`${this.constructor.name}.byId(${id}, ${requesterDid})`);
    let jwtRec = await dbService.jwtById(id)
    if (jwtRec) {
      let result = {
        id: jwtRec.id,
        issuedAt: jwtRec.issuedAt,
        issuer: jwtRec.issuer,
        subject: jwtRec.subject,
        claimContext: jwtRec.claimContext,
        claimType: jwtRec.claimType,
        claim: JSON.parse(jwtRec.claim),
        handleId:jwtRec.handleId
      }
      return result
    } else {
      return null
    }
  }

  async byQuery(params) {
    l.trace(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    const resultData = await dbService.jwtsByParams(params)
    const result = resultData.map(j => {
      const thisOne = {
        id: j.id, issuer: j.issuer, issuedAt: j.issuedAt, subject: j.subject,
        claimContext: j.claimContext, claimType: j.claimType,
        claim: JSON.parse(j.claim), handleId: j.handleId
      }
      return thisOne
    })
    return result
  }

  /**
   * Dangerous: this includes encoded data that might include private DIDs.
   */
  async fullJwtById(id, requesterDid) {
    l.trace(`${this.constructor.name}.fullJwtById(${id}, ${requesterDid})`);
    let jwtRec = await dbService.jwtById(id)
    if (jwtRec) {
      return jwtRec
    } else {
      return null
    }
  }

  async thisClaimAndConfirmationsIssuersMatchingClaimId(claimId) {
    let jwtClaim = await dbService.jwtById(claimId)
    if (!jwtClaim) {
      return []
    } else {
      let confirmers = await dbService.confirmersForClaims([claimId])
      let allDids = R.append(jwtClaim.issuer, confirmers)
      return R.uniq(allDids)
    }
  }

  async getRateLimits(requestorDid) {
    const registered = await dbService.registrationByDid(requestorDid)
    if (registered) {
      const startOfMonthDate = DateTime.utc().startOf('month')
      const startOfMonthEpoch = Math.floor(startOfMonthDate.valueOf() / 1000)
      const startOfWeekDate = DateTime.utc().startOf('week') // luxon weeks start on Mondays
      const startOfWeekString = startOfWeekDate.toISO()
      const result = {
        nextMonthBeginDateTime: startOfMonthDate.plus({months: 1}).toISO(),
        nextWeekBeginDateTime: startOfWeekDate.plus({weeks: 1}).toISO(),
      }

      const claimedCount = await dbService.jwtCountByAfter(requestorDid, startOfWeekString)
      result.doneClaimsThisWeek = claimedCount

      const regCount = await dbService.registrationCountByAfter(requestorDid, startOfMonthEpoch)
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
    return dbService.jwtClaimsAndIdsUnmerkled()
      .then(idAndClaimArray => {
        return dbService.jwtLastMerkleHash()
          .then(hashHexArray => {
            let seedHex = ""
            if (hashHexArray.length > 0) {
              seedHex = hashHexArray[0].hashChainHex
            }
            const updates = []
            let latestHashChainHex = seedHex
            for (let idAndClaim of idAndClaimArray) {
              latestHashChainHex = hashChain(latestHashChainHex, [idAndClaim])
              if (idAndClaim.hashHex === null) {
                l.error(
                  "Found entries without a hashed claim, indicating some"
                  + " problem when inserting jwt records. Will create."
                )
                idAndClaim.hashHex = hashedClaimWithHashedDids(idAndClaim)
              }
              updates.push(dbService.jwtSetMerkleHash(
                idAndClaim.id, idAndClaim.hashHex, latestHashChainHex
              ))
            }
            return Promise.all(updates)
          })
          .catch(e => {
            l.error(e, "Got error while saving hashes: " + e)
            return Promise.reject(e)
          })
      })
      .catch(e => {
        l.error(e, "Got error while retrieving unchained claims: " + e)
        return Promise.reject(e)
      })
  }

  async checkOfferConfirms(
    issuerDid, issuedAt, giveRecipientId, giveUnit, giveAmount,
    giveFulfillsId, giveFulfillsTypeId, giveFulfillsPlanId,
    isOnlyConfirmation
  ) {
    if (giveFulfillsId && giveFulfillsTypeId == 'Offer') {
      const offers =
            await dbService.offersByParamsPaged({ handleId: giveFulfillsId })
      if (offers.data.length > 0) {
        const offer = offers.data[0]

        let confirmedAmount = 0
        let confirmedNonAmount = 0
        // confirm if this issuer is the direct offer & give recipient
        if (issuerDid == offer.recipientId
            || issuerDid == giveRecipientId) {
          // hooray! now confirm the amount or non-amount
          if (giveUnit == offer.unit
              && giveAmount > 0) {
            confirmedAmount = giveAmount
          } else {
            confirmedNonAmount = 1
          }

        } else if (offer.recipientPlanId
                   // if there is no plan in the offer, allow plan from give
                   || giveFulfillsPlanId) {
          // gotta look further into the associated plan
          const planId = offer.recipientPlanId || giveFulfillsPlanId
          const plan = await dbService.planInfoByHandleId(planId)
          if (plan
              && (issuerDid == plan.issuerDid || issuerDid == plan.agentDid)) {
            if (giveUnit == offer.unit
                && giveAmount > 0) {
              confirmedAmount = giveAmount
            } else {
              confirmedNonAmount = 1
            }
          }
        }
        const amountToUpdate = isOnlyConfirmation ? 0 : (giveAmount || 0)
        await dbService.offerUpdateAmounts(
          offer.handleId, issuedAt, amountToUpdate, confirmedAmount,
          confirmedNonAmount
        )
      }
    }
  }

  async retrieveConfirmersForClaimsEntryIds(claimEntryIds) {
    const allConfirmers = await dbService.confirmersForClaims(claimEntryIds)
    return R.uniq(allConfirmers)
  }

  /**
     @param origClaim is the claim contained inside the confirmation

     @return object with: {
       confirmId: NUMBER,
       actionClaimId: NUMBER,
       orgRoleClaimId: NUMBER,
       tenureClaimId: NUMBER
     }
       ... where confirmId is -1 if something went wrong, and all others are optional
   **/
  async createOneConfirmation(jwtId, issuerDid, issuedAt, confirmedClaim) {

    l.trace(`${this.constructor.name}.createOneConfirmation(${jwtId},`
            + ` ${issuerDid}, ${util.inspect(confirmedClaim)})`);

    // if an Endorser.ch ID is supplied
    // then load that and its internal JWT ID and ignore the other confirmedClaim contents
    let origClaim = confirmedClaim
    let origClaimJwtId = null
    if (origClaim['jwtId']) {
      let origJwt = await dbService.jwtById(origClaim['jwtId'])
      if (origJwt) {
        origClaim = JSON.parse(origJwt.claim)
        origClaimJwtId = origJwt.id
      } else {
        const embeddedResult = {
          embeddedRecordError:
            `This confirmation referenced some unknown jwtId so it will not be recorded.`
        }
        return embeddedResult
      }
    } else if (origClaim['handleId']) {
      let origJwt = dbService.jwtLastByHandleId(origClaim['handleId'])
      if (origJwt) {
        origJwt = JSON.parse(origJwt.claim)
        origClaimJwtId = origJwt.id
      } else {
        const embeddedResult = {
          embeddedRecordError:
              `This confirmation referenced some unknown handleId so it will not be recorded.`
        }
        return embeddedResult
      }
    }
    if (origClaimJwtId) {
      // If this is already explicitly confirmed by this person, reject as a duplicate.
      const previous = await dbService.confirmationByIssuerAndJwtId(issuerDid, origClaimJwtId)
      if (previous) {
        return { embeddedRecordError:
          `Attempted to confirm a claim already confirmed in JWT ${previous.jwtId}`
        }
      }
    }

    // since AgreeAction is from schema.org, the embedded claim is the same by default
    if (origClaim['@context'] == null) {
      origClaim['@context'] = 'https://schema.org'
    }

    if (isContextSchemaOrg(origClaim['@context'])
        && origClaim['@type'] === 'GiveAction') {

      let embeddedResult = {}, result = {}, origGive

      // find the original give
      if (origClaimJwtId) {
        const origGives =
            await dbService.givesByParamsPaged({ jwtId: origClaimJwtId })
        l.trace(`... createOneConfirm origGive lookup by jwtId gave ${util.inspect(origGives)}`)
        if (origGives.data.length > 0) {
          origGive = origGives.data[0]
        }
      } else {
        const origFullId = origClaim.identifier || origClaim.handleId
        if (origFullId) {
          const globalOrigId = globalId(origFullId)
          const origGives =
              await dbService.givesByParamsPaged({ handleId: globalOrigId })
          l.trace(`... createOneConfirm origGive lookup by full ID gave ${util.inspect(origGives)}`)
          if (origGives.data.length > 0) {
            origGive = origGives.data[0]
            origClaimJwtId = origGive.jwtId
          }
        }
      }
      if (!origGive) {

        embeddedResult = {
          embeddedRecordError:
          `This confirmation referenced some unknown give record`
            + ` so it has no effect.`
            + ` When not referencing an existing record,`
            + ` just send a separate 'give' claim instead of a confirmation.`
        }

      } else {

        // There are a couple of versions of the original claim:
        // - origClaim is claim that was sent, or if an ID was sent then claim loaded from the DB jwt table
        // - origGive is the Give record from the custom table

        l.trace(`... createOneConfirm orig ID & give ${util.inspect(origGive)})`)

        let origClaimStr = canonicalize(origClaim)
        result =
            await dbService.confirmationInsert(issuerDid, jwtId, origClaimJwtId, origClaimStr)

        // will mark the give as confirmed by recipient, if this is a recipient
        let confirmedByRecipient = false
        if (issuerDid == origGive.recipientDid) {
          confirmedByRecipient = true
        } else {
          // check also for creator of plan
          const planId = origGive.fulfillsPlanId
          if (planId) {
            const plan = await dbService.planInfoByHandleId(planId)
            if (issuerDid == plan?.issuerDid
                || issuerDid == plan?.agentDid) {
              confirmedByRecipient = true
            }
          }
        }
        if (confirmedByRecipient) {
          const amount =
            origClaim.object?.amount && (origClaim.object.unit == origGive.unit)
            // if an amount was sent with matching unit, let's add that amount
            ? origClaim.object.amount
            // otherwise, just take the original claim, or 1
            : (origGive.amount || 1)

          await dbService.giveUpdateConfirmed(
            origGive.handleId, amount, issuedAt
          )

          // now check if any associated offer also needs updating
          await this.checkOfferConfirms(
            issuerDid, issuedAt, origGive.recipientDid,
            origGive.unit, origGive.amount,
            origGive.fulfillsId, origGive.fulfillsType,
            origGive.fulfillPlansId, true
          )

        }

      }

      return R.mergeLeft({ confirmationId: result }, embeddedResult)

    } else if (isContextSchemaOrg(origClaim['@context'])
        && origClaim['@type'] === 'JoinAction') {

      const events = await dbService.eventsByParams({
        orgName: origClaim.event.organizer.name,
        name: origClaim.event.name,
        startTime: origClaim.event.startTime
      })
      if (events.length === 0) {
        return Promise.reject("Attempted to confirm action at an unrecorded event.")
      }

      // agent.did is for legacy data, some still in mobile app
      const agentDid = origClaim.agent?.identifier || origClaim.agent?.did

      const actionClaim = await dbService.actionClaimByDidEventId(agentDid, events[0].id)
      if (!actionClaim?.rowid) {
        return Promise.reject("Attempted to confirm an unrecorded action.")
      }
      const actionClaimJwtId = origClaimJwtId || actionClaim.jwtId

      // check for duplicate
      const confirmation = await dbService.confirmationByIssuerAndAction(issuerDid, actionClaim.rowid)
      if (confirmation !== null) {
        return Promise.reject(
          `Attempted to confirm an action already confirmed in ${confirmation.jwtId}`
        )
      }

      const origClaimStr = canonicalize(origClaim)

      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, actionClaimJwtId, origClaimStr, actionClaim.rowid, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added`
              + ` for actionClaimId ${actionClaimId}`
             )
      return {confirmationId:result, actionClaimId}


    } else if (origClaim['@context'] === 'https://endorser.ch'
               && origClaim['@type'] === 'Tenure') {

      // party.did is for legacy data, some still in mobile app
      const partyDid = origClaim.party?.identifier || origClaim.party?.did

      const tenureClaim = await dbService.tenureClaimByPartyAndGeoShape(partyDid, origClaim.spatialUnit.geo.polygon)
      if (!tenureClaim?.rowid) {
        return Promise.reject("Attempted to confirm an unrecorded tenure.")
      }
      const tenureClaimJwtId = origClaimJwtId || tenureClaim.jwtId

      // check for duplicate
      const confirmation = await dbService.confirmationByIssuerAndTenure(issuerDid, tenureClaim.rowid)
      if (confirmation) {
        return Promise.reject(
          `Attempted to confirm a tenure already confirmed in ${confirmation.jwtId}`
        )
      }

      const origClaimStr = canonicalize(origClaim)

      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, tenureClaimJwtId, origClaimStr, null, tenureClaim.rowid, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
              + ` added for tenureClaimId ${tenureClaimId}`);
      return {confirmationId:result, tenureClaimId}


    } else if (isContextSchemaOrg(origClaim['@context'])
               && origClaim['@type'] === 'Organization'
               && origClaim.member
               && origClaim.member['@type'] === 'OrganizationRole'
               && origClaim.member.member
               && origClaim.member.member.identifier) {

      const orgRoleClaim =
          await dbService.orgRoleClaimByOrgAndDates(
              origClaim.name, origClaim.member.roleName, origClaim.member.startDate,
              origClaim.member.endDate, origClaim.member.member.identifier
          )
      if (!orgRoleClaim?.rowid) {
        return Promise.reject("Attempted to confirm an unrecorded orgRole.")
      }
      const orgRoleClaimJwtId = origClaimJwtId || orgRoleClaim.jwtId

      // check for duplicate
      const confirmation = await dbService.confirmationByIssuerAndOrgRole(issuerDid, orgRoleClaim.rowid)
      if (confirmation) {
        return Promise.reject(
          `Attempted to confirm a orgRole already confirmed in ${confirmation.jwtId}`
        )
      }

      const origClaimStr = canonicalize(origClaim)

      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, orgRoleClaimJwtId, origClaimStr, null, null, orgRoleClaim.rowid)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
              + ` added for orgRoleClaimId ${orgRoleClaimId}`
             )
      return {confirmationId:result, orgRoleClaimId}


    } else {

      /**
      // check for duplicate
      // ... someday, when we decide to index the whole claim or find something efficient
      const confirmation = await dbService.confirmationByIssuerAndOrigClaim(issuerDid, origClaim)
      if (confirmation) {
        return Promise.reject(
          `Attempted to confirm a claim already confirmed in # ${confirmation.id}`
        )
      }
      **/

      const origClaimStr = canonicalize(origClaim)

      // If we choose to add the subject, it's found in these places (as of today):
      //   claim.[ agent | member.member | party | participant ].identifier
      //
      //   The "did" version is for legacy data, maybe still in mobile app.
      //   claim.[ agent | member.member | party | participant ].did

      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, origClaimJwtId, origClaimStr, null, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
              + ` added for a generic confirmation`
             )
      return {confirmationId:result}

    }
  }

  async createGive(jwtId, issuerDid, issuedAt, handleId, claim) {

    let fulfillsId = claim.fulfills?.identifier
    let fulfillsClaim = claim.fulfills
    if (fulfillsId) {
      const idAsHandle = globalId(fulfillsId)
      const loadedFulfillsObj = await dbService.jwtLastByHandleIdRaw(idAsHandle)
      if (loadedFulfillsObj) {
        fulfillsClaim = JSON.parse(loadedFulfillsObj.claim)
      }
    }

    let fulfillsType = fulfillsClaim?.['@type']

    // now want to record if this is a part of a PlanAction, so
    // look through fulfills and it's parent to see if any are a PlanAction
    let fulfillsPlanId
    if (fulfillsType == 'PlanAction') {
      fulfillsPlanId = globalId(fulfillsId)
    }
    if (!fulfillsPlanId) {
      // now look for Plan in parentage, ie isPartOf and itemOffered.isPartOf

      let fulfillsClaimParent = fulfillsClaim?.isPartOf
      if (fulfillsClaimParent?.identifier) {
        const idAsHandle = globalId(fulfillsClaimParent.identifier)
        const loadedFulfillsObj = await dbService.jwtLastByHandleIdRaw(idAsHandle)
        if (loadedFulfillsObj) {
          fulfillsClaimParent = JSON.parse(loadedFulfillsObj.claim)
        }
      }
      if (fulfillsClaimParent?.['@type'] == 'PlanAction') {
        fulfillsPlanId = globalId(fulfillsClaimParent.identifier)
      }
    }
    if (!fulfillsPlanId) {
      let fulfillsClaimParent = fulfillsClaim?.itemOffered?.isPartOf
      if (fulfillsClaimParent?.identifier) {
        const idAsHandle = globalId(fulfillsClaimParent.identifier)
        const loadedFulfillsObj = await dbService.jwtLastByHandleIdRaw(idAsHandle)
        if (loadedFulfillsObj) {
          fulfillsClaimParent = JSON.parse(loadedFulfillsObj.claim)
        }
      }
      if (fulfillsClaimParent?.['@type'] == 'PlanAction') {
        fulfillsPlanId = globalId(fulfillsClaimParent.identifier)
      }
    }

    const byRecipient = issuerDid == claim.recipient?.identifier
    const amountConfirmed = byRecipient ? (claim.object?.amountOfThisGood || 1) : 0

    let entry = {
      jwtId: jwtId,
      handleId: handleId,
      issuedAt: issuedAt,
      updatedAt: issuedAt,
      agentDid: claim.agent?.identifier || issuerDid,
      recipientDid: claim.recipient?.identifier,
      fulfillsId: fulfillsId,
      fulfillsType: fulfillsType,
      fulfillsPlanId: fulfillsPlanId,
      amount: claim.object?.amountOfThisGood,
      unit: claim.object?.unitCode,
      description: claim.description,
      amountConfirmed: amountConfirmed,
      fullClaim: canonicalize(claim),
    }

    let giveRecord = await dbService.giveInfoByHandleId(handleId)
    if (giveRecord == null) {
      // new record
      let giveId = await dbService.giveInsert(entry)
    } else {
      // edit existing record
      entry.updatedAt = new Date().toISOString()
      await dbService.giveUpdate(entry)
      // ... and delete providers
      await dbService.giveProviderDelete(handleId)
    }

    // now save any providers
    let providers = claim.provider
    if (providers) {
      if (!Array.isArray(providers)) {
        providers = [providers]
      }
      for (const provider of providers) {
        if (provider.identifier) {
          const fullId = globalId(provider.identifier)
          await dbService.giveProviderInsert({
            giveHandleId: handleId,
            providerHandleId: fullId
          })
        }
      }
    }

    return entry
  }

  async createEmbeddedClaimEntry(jwtId, issuerDid, issuedAt, handleId, claim) {

    if (isContextSchemaOrg(claim['@context'])
        && claim['@type'] === 'AgreeAction') {

      // note that @type of 'Confirmation' does similar logic (but is deprecated)

      l.trace('Adding AgreeAction confirmation', claim)

      let recordings = []
      {
        let origClaim = claim['object']
        if (Array.isArray(origClaim)) {
          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (let claim of origClaim) {
            // this must await (see note above)
            const conf = await this.createOneConfirmation(jwtId, issuerDid, issuedAt, claim)
                .catch(e => { embeddedRecordError: e })
            recordings.push(conf)
          }
        } else if (origClaim) {
          // this must await (see note above)
          const conf = await this.createOneConfirmation(jwtId, issuerDid, issuedAt, origClaim)
            .catch(e => { embeddedRecordError: e })
          recordings.push(conf)
        }
      }
      return { confirmations: recordings }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'GiveAction') {

      const newGive =
            await this.createGive(jwtId, issuerDid, issuedAt, handleId, claim)

      this.checkOfferConfirms(
        issuerDid, issuedAt, newGive.recipientDid, newGive.unit, newGive.amount,
        newGive.fulfillsId, newGive.fulfillsType, newGive.fulfillsPlanId, false
      )

      l.trace(`${this.constructor.name} New give ${util.inspect(newGive)}`)
      return newGive

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'JoinAction') {

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      if (!agentDid) {
        l.error(`Error in ${this.constructor.name}: JoinAction for ${jwtId} has no agent DID.`)
        return Promise.reject(
          new Error("Attempted to record a JoinAction claim with no agent DID.")
        )
      }

      if (!claim.event) {
        l.error(`Error in ${this.constructor.name}: JoinAction for ${jwtId} has no event info.`)
        return Promise.reject(
          "Attempted to record a JoinAction claim with no event info."
        )
      }

      let event
      const orgName = claim.event.organizer && claim.event.organizer.name
      const events =
          await dbService.eventsByParams({
            orgName:orgName, name:claim.event.name, startTime:claim.event.startTime
          })

      if (events.length === 0) {
        let eventId = await dbService.eventInsert(orgName, claim.event.name, claim.event.startTime)
        event = {
          id:eventId, orgName:orgName, name:claim.event.name, startTime:claim.event.startTime
        }
        l.trace(`${this.constructor.name} New event # ${util.inspect(event)}`)

      } else {
        event = events[0]
        if (events.length > 1) {
          l.warn(
            `${this.constructor.name} Multiple events exist with orgName`
              + ` ${orgName} name ${claim.event.name}`
              + ` startTime ${claim.event.startTime}`
          )
        }

        const actionClaim = await dbService.actionClaimByDidEventId(agentDid, events[0].id)
        if (actionClaim) {
          return Promise.reject(
            "Same user attempted to record an action claim that already exists with ID " + actionClaim.rowid
          )
        }

      }

      let actionId = await dbService.actionClaimInsert(issuerDid, agentDid, jwtId, event)
      l.trace(`${this.constructor.name} New action # ${actionId}`)
      return { actionId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Offer') {

      let planId =
          claim.itemOffered?.isPartOf
          && claim.itemOffered.isPartOf['@type'] == 'PlanAction'
          && claim.itemOffered.isPartOf.identifier
      if (planId) {
        planId = globalId(planId)
      }

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const validTime = new Date(claim.validThrough)
      const validTimeStr =
        isNaN(validTime.getTime()) ? undefined : validTime.toISOString()

      let entry = {
        jwtId: jwtId,
        handleId: handleId,
        issuedAt: issuedAt,
        updatedAt: issuedAt,
        offeredByDid: claim.offeredBy?.identifier || issuerDid,
        recipientDid: claim.recipient?.identifier,
        recipientPlanId: planId,
        amount: claim.includesObject?.amountOfThisGood,
        unit: claim.includesObject?.unitCode,
        objectDescription: claim.itemOffered?.description,
        validThrough: validTimeStr,
        fullClaim: canonicalize(claim),
      }
      let offerId = await dbService.offerInsert(entry)
      l.trace(`${this.constructor.name} New offer ${offerId} ${util.inspect(entry)}`)
      return { offerId }

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
      let orgRoleId = await dbService.orgRoleInsert(entry)
      l.trace(`${this.constructor.name} New org role ${orgRoleId} ${util.inspect(entry)}`)
      return { orgRoleId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'PlanAction') {

      // note that this is similar to Project

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const startTime = new Date(claim.startTime)
      const startTimeStr =
        isNaN(startTime.getTime()) ? undefined : startTime.toISOString()
      const endTime = new Date(claim.endTime)
      const endTimeStr =
        isNaN(endTime.getTime()) ? undefined : endTime.toISOString()

      const entry = {
        jwtId: jwtId,
        agentDid: agentDid,
        issuerDid: issuerDid,
        handleId: handleId,
        name: claim.name,
        description: claim.description,
        image: claim.image,
        endTime: endTimeStr,
        startTime: startTimeStr,
        resultDescription: claim.resultDescription,
        resultIdentifier: claim.resultIdentifier,
        url: claim.url,
      }

      let planRecord = await dbService.planInfoByHandleId(handleId)
      if (planRecord == null) {
        // new record
        const planId = await dbService.planInsert(entry)
        l.trace(`${this.constructor.name} New plan ${planId} ${util.inspect(entry)}`)
        return { handleId, recordsSavedForEdit: 1, planId }

      } else {
        // edit existing record
        const numUpdated = await dbService.planUpdate(entry)
        l.trace(`${this.constructor.name} Edit plan ${util.inspect(entry)}`)
        return { handleId, recordsSavedForEdit: numUpdated }
      }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Project') {

      // note that this is similar to PlanAction

      // agent.did is for legacy data, some still in the mobile app
      let agentDid = claim.agent?.identifier || claim.agent?.did

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const startTime = new Date(claim.startTime)
      const startTimeStr =
        isNaN(startTime.getTime()) ? undefined : startTime.toISOString()
      const endTime = new Date(claim.endTime)
      const endTimeStr =
        isNaN(endTime.getTime()) ? undefined : endTime.toISOString()

      const entry = {
        jwtId: jwtId,
        agentDid: agentDid,
        issuerDid: issuerDid,
        handleId: handleId,
        name: claim.name,
        description: claim.description,
        image: claim.image,
        endTime: endTimeStr,
        startTime: startTimeStr,
        resultDescription: claim.resultDescription,
        resultIdentifier: claim.resultIdentifier,
        url: claim.url,
      }

      let projectRecord = await dbService.projectInfoByHandleId(handleId)
      if (projectRecord == null) {
        // new record
        const projectId = await dbService.projectInsert(entry)
        l.trace(`${this.constructor.name} New project ${projectId} ${util.inspect(entry)}`)
        return { handleId, recordsSavedForEdit: 1, projectId }

      } else {
        // edit existing record
        const numUpdated = await dbService.projectUpdate(entry)
        l.trace(`${this.constructor.name} Edit project ${util.inspect(entry)}`)
        return { handleId, recordsSavedForEdit: numUpdated }
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

      let registrationId = await dbService.registrationInsert(registration)
      l.trace(`${this.constructor.name} New registration ${registrationId} ${util.inspect(registration)}`)
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

      let tenureId = await dbService.tenureInsert(entry)
      l.trace(`${this.constructor.name} New tenure ${tenureId} ${util.inspect(entry)}`)
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

      let voteId = await dbService.voteInsert(entry)
      l.trace(`${this.constructor.name} New vote ${voteId} ${util.inspect(entry)}`)
      return { voteId }


    } else if (isContextSchemaForConfirmation(claim['@context'])
               && claim['@type'] === 'Confirmation') {

      // this is for "legacy Confirmation" and can be deprecated; see AgreeAction

      const recordings = []

      { // handle a single claim
        const origClaim = claim['originalClaim']
        if (origClaim) {
          recordings.push(
            await this.createOneConfirmation(jwtId, issuerDid, origClaim)
              .catch(e => { embeddedRecordError: e })
          )
        }
      }

      { // handle multiple claims
        const origClaims = claim['originalClaims']
        if (origClaims) {
          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (let origClaim of origClaims) {
            recordings.push(
              await this.createOneConfirmation(jwtId, issuerDid, origClaim)
                .catch(e => { embeddedRecordError: e })
            )
          }
        }
      }
      l.trace(`${this.constructor.name} Created ${recordings.length}`
              + ` confirmations & network records.`, recordings)

      let confirmations = await Promise.all(recordings)
      return { confirmations }

    } else {
      l.info("Submitted unknown claim type with @context " + claim['@context']
             + " and @type " + claim['@type']
             + "  This isn't a problem, it just means there is no dedicated"
             + " storage or reporting for that type."
            )

      return {}
    }

  }

  async createEmbeddedClaimEntries(jwtId, issuerDid, issuedAt, handleId, claim) {

    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(${jwtId}, ${issuerDid}, ...)`);
    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(..., ${util.inspect(claim)})`);

    let embeddedResults
    if (Array.isArray(claim)) {

      return { clientError: 'We do not support sending multiple at once. Send individually.' }

      /**
      // Here's how we used to support it.
      // If you want this, you'll need to figure if and how to manage claim IDs & handles.

      if (Array.isArray.payloadClaim
          && R.filter(c => c['@type'] === 'Project', claim).length > 1) {
        // To allow this, you'll have to assign different IDs to each project.
        return { clientError:
          'Sending multiple Projects at once does not allow editing. Send individually.'
        }
      }

      let recordings = []
      { // handle multiple claims
        for (let subClaim of claim) {
          recordings.push(
            this.createEmbeddedClaimEntry(jwtId, issuerDid, issuedAt, handleId, subClaim)
          )
        }
      }
      l.trace(`${this.constructor.name} creating ${recordings.length} claim records.`)

      embeddedResults = await Promise.all(recordings)
      **/

    } else {
      // it's not an array
      embeddedResults =
        await this.createEmbeddedClaimEntry(jwtId, issuerDid, issuedAt, handleId, claim)
      l.trace(`${this.constructor.name} created an embedded claim record.`)
    }

    // now record all the "sees" relationships to the issuer
    const netRecords = []
    for (let did of allDidsInside(claim)) {
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
        l.warn("JWT with exp " + payload.exp
               + " has expired but we're in test mode so using a new time."
              )
        payload.exp = nowEpoch + 100
      }
      return {payload, issuer: payload.iss, header: {typ: "test"}} // other elements will = undefined
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
  async createWithClaimEntry(jwtEncoded, authIssuerId) {
    l.trace(`${this.constructor.name}.createWithClaimRecord(ENCODED)`);
    l.trace(jwtEncoded, `${this.constructor.name} ENCODED`)

    // available: {didResolutionResult w/ didDocument, issuer, payload, policies, signer, verified}
    const { payload } =
        await this.decodeAndVerifyJwt(jwtEncoded)
        .catch((err) => {
          return Promise.reject(err)
        })

    if (authIssuerId && payload.iss !== authIssuerId) {
      return Promise.reject(`JWT issuer ${authIssuerId} does not match claim issuer ${payload.iss}`)
    }

    const registered = await dbService.registrationByDid(payload.iss)
    if (!registered) {
      return Promise.reject(
        { clientError: {
          message: `You are not registered to make claims. Contact an existing user for help.`,
          code: ERROR_CODES.UNREGISTERED_USER
        }}
      )
    }

    const startOfWeekDate = DateTime.utc().startOf('week') // luxon weeks start on Mondays
    const startOfWeekString = startOfWeekDate.toISO()
    const claimedCount = await dbService.jwtCountByAfter(payload.iss, startOfWeekString)
    // 0 shouldn't mean DEFAULT
    const maxAllowedClaims =
          registered.maxClaims != null ? registered.maxClaims : DEFAULT_MAX_CLAIMS_PER_WEEK
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
        const regCount = await dbService.registrationCountByAfter(payload.iss, startOfMonthEpoch)
        // 0 shouldn't mean DEFAULT
        const maxAllowedRegs =
              registered.maxRegs != null ? registered.maxRegs : DEFAULT_MAX_REGISTRATIONS_PER_MONTH
        if (regCount >= maxAllowedRegs) {
          return Promise.reject({ clientError: {
            message: `You have already registered ${maxAllowedRegs} this month.`
              + ` Contact an administrator for a higher limit.`,
            code: ERROR_CODES.OVER_REGISTRATION_LIMIT
          }})
        }

        const startOfWeekEpoch = Math.floor(startOfWeekDate.valueOf() / 1000)
        if (registered.epoch > startOfWeekEpoch) {
          return Promise.reject(
            { clientError: {
              message: `You cannot register others the same week you got registered.`,
              code: ERROR_CODES.CANNOT_REGISTER_TOO_SOON
            } }
          )
        }
      }

      // Generate the local id and find or generate the global "entity" handle ID.
      let jwtId = dbService.newUlid()
      let handleId
      // If this has an identifier, check the previous instance to see if they are allowed to edit.
      if (payloadClaim.identifier) { // 'identifier' is a schema.org convention; may add others

        handleId =
          isGlobalUri(payloadClaim.identifier)
          ? payloadClaim.identifier
          : globalFromInternalIdentifier(payloadClaim.identifier)

        const prevEntry = await dbService.jwtLastByHandleIdRaw(handleId)
        if (prevEntry) {
          // There is a previous entry.
          if (payloadClaim["@type"] != prevEntry.claimType) {
            return Promise.reject(
              { clientError: {
                  message: `You cannot change the type of an existing entry.`
                } }
            )

          } else if (payload.iss == prevEntry.issuer || payload.iss == handleId) {
            // The issuer is the same as the previous, or the issuer matches the global handle.
            // We're OK to continue.
          } else {
            // The issuer doesn't match the previous entry issuer or person record.
            // They likely shouldn't be allowed, but we'll allow if they're the agent.
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
        } else {
          // no previous record with that handle exists
          if (!isGlobalUri(payloadClaim.identifier)) {
            // Don't allow any non-global IDs if they don't already exist
            // ie. if they weren't created by this server.
            // (If you allow this, ensure they can't choose any past or future jwtId.)
            return Promise.reject(
              {
                clientError: {
                  message:
                  `You cannot use a non-global-URI identifer you don't already own.`
                }
              }
            )
          }
        }
      } else {
        // There's no payloadClaim.identifier
        handleId = globalFromInternalIdentifier(jwtId)
      }

      const claimStr = canonicalize(payloadClaim)
      const claimEncoded = base64url.encode(claimStr)
      const jwtEntry = dbService.buildJwtEntry(
        payload, jwtId, handleId, payloadClaim, claimStr, claimEncoded, jwtEncoded
      )
      const jwtRowId =
          await dbService.jwtInsert(jwtEntry)
          .catch((err) => {
            return Promise.reject(err)
          })

      //l.trace(doc, `${this.constructor.name} resolved doc`)
      //l.trace(authenticators, `${this.constructor.name} resolved authenticators`)
      //l.trace(issuer, `${this.constructor.name} resolved issuer`)

      const issuerDid = payload.iss

      // this is the same as the doc.publicKey in my example
      //const signer = VerifierAlgorithm(header.alg)(data, signature, authenticators)

      let embedded =
          await this.createEmbeddedClaimEntries(
            jwtEntry.id, issuerDid, jwtEntry.issuedAt, handleId, payloadClaim
          )
          .catch(err => {
            l.error(err, `Failed to create embedded claim records.`)
            return { embeddedRecordError: err }
          })

      const result = R.mergeLeft({ claimId: jwtEntry.id, handleId: handleId }, embedded)
      l.trace(`${this.constructor.name}.createWithClaimRecord`
              + ` resulted in ${util.inspect(result)}`)
      return result

    } else {
      l.warn(`${this.constructor.name} JWT received without a claim.`)
      return Promise.reject("JWT had no 'claim' property.")
    }
  }

}

export default new ClaimService();
