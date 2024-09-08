import canonicalize from 'canonicalize'
import crypto from 'crypto'
import {DateTime, Duration} from 'luxon'
import R from 'ramda'
import util from 'util'

import l from '../../common/logger'
import {dbService} from './endorser.db.service'
import {
  allDidsInside,
  calcBbox,
  claimHashChain,
  ERROR_CODES,
  findAllLastClaimIdsAndHandleIds,
  globalFromInternalIdentifier,
  isGlobalEndorserHandleId,
  isGlobalUri,
} from './util';
import {addCanSee} from './network-cache.service'
import {decodeAndVerifyJwt} from "./vc";

const SERVICE_ID = process.env.SERVICE_ID || "endorser.ch"

const DEFAULT_MAX_REGISTRATIONS_PER_MONTH =
      process.env.DEFAULT_MAX_REGISTRATIONS_PER_MONTH || 31
const DEFAULT_MAX_CLAIMS_PER_WEEK =
      process.env.DEFAULT_MAX_CLAIMS_PER_WEEK || 140

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
        handleId: jwtRec.handleId,
        noncedHash: jwtRec.noncedHash,
      }
      return result
    } else {
      return null
    }
  }

  /**
   * BEWARE: this includes encoded data that might include private DIDs.
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

  async byQuery(params) {
    l.trace(`${this.constructor.name}.byQuery(${util.inspect(params)})`);
    const resultData = await dbService.jwtsByParams(params)
    const result = resultData.map(j => {
      const thisOne = {
        id: j.id, issuer: j.issuer, issuedAt: j.issuedAt, subject: j.subject,
        claimContext: j.claimContext, claimType: j.claimType,
        claim: JSON.parse(j.claim), handleId: j.handleId,
        noncedHash: j.noncedHash,
      }
      return thisOne
    })
    return result
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
      const startOfMonthEpoch = startOfMonthDate.toSeconds()
      const startOfWeekDate = DateTime.utc().startOf('week') // luxon weeks start on Mondays
      const startOfWeekString = startOfWeekDate.toISO()
      const result = {
        nextMonthBeginDateTime: startOfMonthDate.plus(Duration.fromObject({months: 1})).toISO(),
        nextWeekBeginDateTime: startOfWeekDate.plus(Duration.fromObject({weeks: 1})).toISO(),
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
        clientError: { message: 'Rate limits are only available to registered users.',
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
    return dbService.jwtClaimsAndHashesUnmerkled()
      .then(hashAndClaimStrArray => {
        return dbService.jwtLastMerkleHash()
          .then(hashHexArray => {
            let seed = ""
            if (hashHexArray?.length > 0) {
              seed = hashHexArray[0].noncedHashAllChain
            }
            const updates = []
            let latestHashChain = seed
            for (let hashAndClaimStr of hashAndClaimStrArray) {
              const canon = canonicalize(JSON.parse(hashAndClaimStr.claim))

              // compute the new global hash
              const newGlobalHashChain = claimHashChain(latestHashChain, [canon])

              // compute the previous individual chain
              const latestHashChainForIssuer =
                dbService.jwtLastMerkleHashForIssuerBefore(hashAndClaimStr.issuer, hashAndClaimStr.id)?.nonceHashIssuerChain || ""
              const newHashChainForIssuer = claimHashChain(latestHashChainForIssuer, [canon])

              updates.push(dbService.jwtSetMerkleHash(hashAndClaimStr.id, newGlobalHashChain, newHashChainForIssuer))

              latestHashChain = newGlobalHashChain
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

  async checkOfferUpdate(
    issuerDid, issuedAt, giveRecipientId, giveUnit, giveAmount,
    giveFulfillsHandleId, giveFulfillsTypeId, giveFulfillsPlanHandleId,
    isOnlyConfirmation
  ) {
    if (giveFulfillsHandleId && giveFulfillsTypeId == 'Offer') {
      const offers =
            await dbService.offersByParamsPaged({ handleId: giveFulfillsHandleId })
      if (offers.data.length > 0) {
        const offer = offers.data[0]

        let confirmedAmount = 0
        let confirmedNonAmount = 0
        // confirm if this issuer is the direct offer & give recipient
        if (issuerDid == offer.recipientDid
            || issuerDid == giveRecipientId) {
          // hooray! now confirm the amount or non-amount
          if (giveUnit == offer.unit
              && giveAmount > 0) {
            confirmedAmount = giveAmount
          } else {
            confirmedNonAmount = 1
          }

        } else if (offer.fulfillsPlanHandleId
                   // if there is no plan in the offer, allow plan from give
                   || giveFulfillsPlanHandleId) {
          // gotta look further into the associated plan
          const planId = offer.fulfillsPlanHandleId || giveFulfillsPlanHandleId
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
        if (amountToUpdate || confirmedAmount || confirmedNonAmount) {
          await dbService.offerUpdateAmounts(
              offer.handleId, issuedAt, amountToUpdate, confirmedAmount,
              confirmedNonAmount
          )
        }
      }
    }
  }

  async retrieveConfirmersForClaimsEntryIds(claimEntryIds) {
    const allConfirmers = await dbService.confirmersForClaims(claimEntryIds)
    return R.uniq(allConfirmers)
  }

  // @param {Object} clause - a clause that may have an entry already in the claimIdDataList & DB
  // @return Object of:
  //   clauseClaim - clause from DB if there's no onlyIfType or the type matches
  //   clauseHandleId
  //   clauseIssuerDid - issuer of the clause claim
  //   clauseLastClaimId
  async retrieveClauseClaimAndIssuer(clause, claimIdDataList, onlyIfType, clauseIssuerDid) {
    let clauseLastClaimId, clauseHandleId
    if (clause?.lastClaimId) {
      clauseLastClaimId = clause.lastClaimId
      // first look in already-cached JWT record list
      const loadedFulfillsParentIdInfo = claimIdDataList.find(claimIdData => claimIdData.lastClaimId === clause?.lastClaimId)
      if (loadedFulfillsParentIdInfo?.lastClaimJwt) {
        clause = JSON.parse(loadedFulfillsParentIdInfo.lastClaimJwt.claim)
        clauseHandleId = loadedFulfillsParentIdInfo.lastClaimJwt.handleId
        clauseIssuerDid = loadedFulfillsParentIdInfo.lastClaimJwt.issuer
        clauseLastClaimId = loadedFulfillsParentIdInfo.lastClaimJwt.id
      }
      // if not found, look in DB
      // (Almost everything is already cached in claimIdDataList but there is a
      // possibility that the "fulfills" clause loaded something new from the
      // DB and we may have to look this up.)
      if (!loadedFulfillsParentIdInfo) {
        const loadedFulfillsParentJwt = await dbService.jwtById(clause.lastClaimId)
        if (loadedFulfillsParentJwt) {
          clause = JSON.parse(loadedFulfillsParentJwt.claim)
          clauseHandleId = loadedFulfillsParentJwt.handleId
          clauseIssuerDid = loadedFulfillsParentJwt.issuer
          clauseLastClaimId = loadedFulfillsParentJwt.id
        }
      }
    } else if (clause?.identifier) {
      clauseHandleId = clause.identifier
      // first look in already-cached JWT record list
      const loadedFulfillsParentIdInfo = claimIdDataList.find(claimIdData => claimIdData.handleId === clause?.identifier)
      if (loadedFulfillsParentIdInfo?.handleJwt) {
        clause = JSON.parse(loadedFulfillsParentIdInfo.handleJwt.claim)
        clauseHandleId = loadedFulfillsParentIdInfo.handleJwt.handleId
        clauseIssuerDid = loadedFulfillsParentIdInfo.handleJwt.issuer
        clauseLastClaimId = loadedFulfillsParentIdInfo.handleJwt.id
      }
      // if not found, look in DB
      // 9Almost everything is already cached in claimIdDataList but there is a
      // possibility that the "fulfills" clause loaded something new from the
      // DB and we may have to look this up.)
      if (!loadedFulfillsParentIdInfo) {
        const loadedFulfillsParentJwt = await dbService.jwtLastByHandleId(clause.identifier)
        if (loadedFulfillsParentJwt) {
          clause = JSON.parse(loadedFulfillsParentJwt.claim)
          clauseHandleId = loadedFulfillsParentJwt.handleId
          clauseIssuerDid = loadedFulfillsParentJwt.issuer
          clauseLastClaimId = loadedFulfillsParentJwt.id
        }
      }
    } else {
      // no lastClaimId or identifier, so the other fields will be the defaults
    }

    if (!onlyIfType
        || clause?.['@type'] === onlyIfType) {
      // return the claim anyway because it may have been inline (so we don't have a JWT record)
      return { clauseClaim: clause, clauseHandleId, clauseIssuerDid, clauseLastClaimId }
    } else {
      return null
    }
  }

  issuerSameAsPersonInLinkedJwt(issuerDid, linkedClaim, linkedJwtIssuerDid) {
    return (
        issuerDid === linkedJwtIssuerDid
        || issuerDid === linkedClaim?.agent?.identifier // for Give & PlanAction
        || issuerDid === linkedClaim?.offeredBy?.identifier // for Offer
    )
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
  async createOneConfirmation(jwtId, issuerDid, issuedAt, confirmedClaim, claimIdDataList) {
    l.trace(`${this.constructor.name}.createOneConfirmation(${jwtId},`
            + ` ${issuerDid}, ${util.inspect(confirmedClaim)})`);

    if (!confirmedClaim) {
      // well that makes no sense
      return {
        embeddedRecordError:
            `This confirmation referenced no claim so it will not be recorded.`
      }
    }

    // if an Endorser.ch ID is supplied
    // then load that and its internal JWT ID and ignore the other confirmedClaim contents
    const claimInfo = await this.retrieveClauseClaimAndIssuer(confirmedClaim, claimIdDataList)
    const origClaim = claimInfo?.clauseClaim || confirmedClaim
    const origClaimJwtId = claimInfo?.clauseLastClaimId
    const origClaimHandleId = claimInfo?.clauseHandleId

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

      let embeddedResult = {}, result = {}

      let origGiveClaim // record from the give_claim table
      // find the original give
      if (origClaimJwtId) {
        const origGives =
            await dbService.givesByParamsPaged({ jwtId: origClaimJwtId })
        if (origGives.data.length > 0) {
          origGiveClaim = origGives.data[0]
          l.trace(`... createOneConfirm origGiveClaim lookup by jwtId gave ${util.inspect(origGiveClaim)}`)
        }
      } else if (origClaimHandleId) {
        // no origClaimJwtId is known, so look at origClaim
        const origGives =
            await dbService.givesByParamsPaged({ handleId: origClaimHandleId })
        if (origGives.data.length > 0) {
          origGiveClaim = origGives.data[0]
          l.trace(`... createOneConfirm origGiveClaim lookup by full ID gave ${util.inspect(origGiveClaim)}`)
        }
      }
      if (!origGiveClaim) {

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
        // - origGiveClaim is the Give record from the caching table

        l.trace(`... createOneConfirm orig ID & give ${util.inspect(origGiveClaim)})`)

        let origClaimStr = canonicalize(origClaim)
        let origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

        // note that this insert is repeated in each case, so might be consolidatable
        result =
          await dbService.confirmationInsert(issuerDid, jwtId, origGiveClaim.jwtId, origClaimStr, origClaimCanonHashBase64)

        // will mark the give as confirmed by recipient, if this is a recipient
        let confirmedByRecipient = false
        if (issuerDid == origGiveClaim.recipientDid) {
          confirmedByRecipient = true
        } else {
          // check also for creator of fulfilled plan
          if (origGiveClaim.fulfillsPlanHandleId) {
            let fulfillsPlanJwt = await dbService.jwtLastByHandleId(origGiveClaim.fulfillsPlanHandleId)
            if (fulfillsPlanJwt) {
              if (issuerDid === fulfillsPlanJwt.issuer) {
                confirmedByRecipient = true
              } else {
                let fulfillsPlanClaim = JSON.parse(fulfillsPlanJwt.claim)
                if (issuerDid === fulfillsPlanClaim.agentDid) {
                  confirmedByRecipient = true
                }
              }
            }
          }
        }
        if (confirmedByRecipient) {
          const amount =
            origClaim.object?.amount && (origClaim.object.unit == origGiveClaim.unit)
            // if an amount was sent with matching unit, let's add that amount
            ? origClaim.object.amount
            // otherwise, just take the original claim, or 1
            : (origGiveClaim.amount || 1)

          await dbService.giveUpdateConfirmed(origGiveClaim.handleId, amount, issuedAt)
          .catch(err => {
            embeddedResult.embeddedRecordError =
                (embeddedResult.embeddedRecordError || '')
                + ` Got an error updating confirmed give amounts: ${err}`
          })

          // now check if any associated offer also needs updating
          await this.checkOfferUpdate(
            issuerDid, issuedAt, origGiveClaim.recipientDid,
            origGiveClaim.unit, origGiveClaim.amount,
            origGiveClaim.fulfillsHandleId, origGiveClaim.fulfillsType,
            origGiveClaim.fulfillsPlanHandleId, true
          )
          .catch(err => {
            embeddedResult.embeddedRecordError =
                (embeddedResult.embeddedRecordError || '')
                + ` Got an error checking if offer amounts need updating: ${err}`
          })
        }

        // confirm contribution link if not yet confirmed
        // (note that there is similar update-link-confirmed code in multiple places)
        if (origClaim.fulfills) {
          const origGiveRecord = await dbService.giveInfoByHandleId(origClaimHandleId)
          if (origGiveRecord?.fulfillsHandleId
              && !origClaim.fulfillsLinkConfirmed) {
            const fulfillsInfo = this.retrieveClauseClaimAndIssuer(origClaim.fulfills, claimIdDataList)
            const fulfillsLinkConfirmed =
                this.issuerSameAsPersonInLinkedJwt(issuerDid, fulfillsInfo.clauseClaim)
            if (fulfillsLinkConfirmed) {
              // this issuer issued plan being fulfilled, so we can set the link confirmed
              origGiveRecord.fulfillsLinkConfirmed = true
              await dbService.offerUpdate(origGiveRecord)
            }
          }
        }

        // mark this issuer as a confirmed provider if they're in the list
        await dbService.giveProviderMarkLinkAsConfirmed(origGiveClaim.handleId, issuerDid)
        .catch(err => {
          embeddedResult.embeddedRecordError =
            (embeddedResult.embeddedRecordError || '')
            + ` Got an error marking this issuer as a confirmed provider: ${err}`
        })
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
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // note that this insert is repeated in each case, so might be consolidatable
      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, actionClaimJwtId, origClaimStr, origClaimCanonHashBase64, actionClaim.rowid, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result} added`
              + ` for actionClaimId ${actionClaimJwtId}`
             )
      return {confirmationId:result, actionClaimJwtId}



    } else if (isContextSchemaOrg(origClaim['@context'])
        && origClaim['@type'] === 'Offer') {

      const origClaimStr = canonicalize(origClaim)
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // note that this insert is repeated in each case, so might be consolidatable
      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, origClaimJwtId, origClaimStr, origClaimCanonHashBase64, null, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
          + ` added for plan with handle ${origClaim.handleId}`)

      // confirm contribution link if not yet confirmed
      // (note that there is similar update-link-confirmed code in multiple places)
      if (origClaim.itemOffered?.isPartOf) {
        const origOfferRecord = await dbService.offerInfoByHandleId(origClaimHandleId)
        if (origOfferRecord?.fulfillsHandleId
            && !origClaim.fulfillsLinkConfirmed) {
          const fulfillsInfo = this.retrieveClauseClaimAndIssuer(origClaim.itemOffered.isPartOf, claimIdDataList)
          const fulfillsLinkConfirmed =
              this.issuerSameAsPersonInLinkedJwt(issuerDid, fulfillsInfo.clauseClaim)
          if (fulfillsLinkConfirmed) {
            // this issuer issued plan being fulfilled, so we can set the link confirmed
            origOfferRecord.fulfillsLinkConfirmed = true
            await dbService.offerUpdate(origOfferRecord)
          }
        }
      }

      return {confirmationId:result, offerHandleId:origClaimHandleId}




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
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // note that this insert is repeated in each case, so might be consolidatable
      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, orgRoleClaimJwtId, origClaimStr, origClaimCanonHashBase64, null, null, orgRoleClaim.rowid)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
          + ` added for orgRoleClaimId ${orgRoleClaimJwtId}`
      )
      return {confirmationId:result, orgRoleClaimJwtId}


    } else if (isContextSchemaOrg(origClaim['@context'])
               && origClaim['@type'] === 'PlanAction') {

      // Note that we don't currently try to match on all the claim data (like
      // we do in the other cases)... it's not our current use case, and ain't
      // nobody got time for that.

      const origClaimStr = canonicalize(origClaim)
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // note that this insert is repeated in each case, so might be consolidatable
      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, origClaimJwtId, origClaimStr, origClaimCanonHashBase64, null, null, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
          + ` added for plan with handle ${origClaim.handleId}`)

      // confirm fulfill link if not yet confirmed
      // (note that there is similar update-link-confirmed code in multiple places)
      if (origClaim.fulfills) {
        const origPlanRecord = await dbService.planInfoByHandleId(origClaimHandleId)
        if (origPlanRecord
            && (origPlanRecord.fulfillsPlanLastClaimId || origPlanRecord.fulfillsPlanHandleId)
            && !origPlanRecord.fulfillsLinkConfirmed) {
          const planFulfillsInfo = await this.retrieveClauseClaimAndIssuer(origClaim.fulfills, claimIdDataList, 'PlanAction')
          const fulfillsLinkConfirmed =
              this.issuerSameAsPersonInLinkedJwt(issuerDid, planFulfillsInfo.clauseClaim)
          if (fulfillsLinkConfirmed) {
            // this issuer issued plan being fulfilled, so we can set the link confirmed
            origPlanRecord.fulfillsLinkConfirmed = true
            await dbService.planUpdate(origPlanRecord)
          }
        }
      }

      return {confirmationId:result, planHandleId:origClaimHandleId}



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
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // note that this insert is repeated in each case, so might be consolidatable
      const result =
          await dbService.confirmationInsert(issuerDid, jwtId, tenureClaimJwtId, origClaimStr, origClaimCanonHashBase64, null, tenureClaim.rowid, null)
      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
              + ` added for tenureClaimId ${tenureClaimJwtId}`)
      return {confirmationId:result, tenureClaimJwtId}


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
      const origClaimCanonHashBase64 =
          crypto.createHash('sha256').update(origClaimStr).digest('base64url')

      // If we choose to add the subject, it's found in these places (as of today):
      //   claim.[ agent | member.member | party | participant ].identifier
      //
      //   The "did" version is for legacy data, maybe still in mobile app.
      //   claim.[ agent | member.member | party | participant ].did

      // note that this insert is repeated in each case, so might be consolidatable
      const resultId =
          await dbService.confirmationInsert(issuerDid, jwtId, origClaimJwtId, origClaimStr, origClaimCanonHashBase64, null, null, null)
      const result = { confirmationId: resultId }
      if (origClaim['@type'] === 'AgreeAction') {
        result.embeddedRecordWarning =
          "This claim has AgreeAction with an embedded AgreeAction, which is probably not what is wanted."
          + " AgreeActions make most sense to directly confirm other statements, not to confirm confirmations."
      }

      l.trace(`${this.constructor.name}.createOneConfirmation # ${result}`
              + ` added for a generic confirmation`
             )

      return result
    }
  }

  async createGive(jwtId, issuerDid, issuedAt, handleId, claim, claimIdDataList, isFirstClaimForHandleId) {

    const embeddedResults = {}

    let claimFulfills = claim.fulfills
    if (Array.isArray(claim.fulfills)) {
      if (claim.fulfills.length === 0) {
        claimFulfills = undefined
      } else {
        claimFulfills = R.find(
          obj => obj.amountOfThisGood || obj.description || obj.handleId || obj.identifier || obj.lastClaimId || obj.object,
          claim.fulfills
        )
        if (claim.fulfills.length > 1) {
          embeddedResults.embeddedRecordWarning =
              "The 'fulfills' field is an array but only the first with amountOfThisGood, description, handleId, identifier, lastClaimId, or object will be checked for amounts & items & plan links."
        }
      }
    }

    // first, record details about a direct "fulfills" link (loading from DB if necessary)
    const fulfillsLastClaimId = claimFulfills?.lastClaimId
    let fulfillsHandleId = claimFulfills?.identifier
    let fulfillsType = claimFulfills?.['@type']
    let fulfillsLinkConfirmed = false
    if (fulfillsLastClaimId) {
      // prefer to pull the data from the DB from previously signed last-claim info
      const loadedFulfillsIdInfo = claimIdDataList.find(claimIdData => claimIdData.lastClaimId === fulfillsLastClaimId)
      let loadedFulfillsJwt = loadedFulfillsIdInfo?.lastClaimJwt
      if (loadedFulfillsJwt) {
        fulfillsHandleId = loadedFulfillsJwt.handleId
        claimFulfills = JSON.parse(loadedFulfillsJwt.claim)
        fulfillsType = claimFulfills?.['@type']
        fulfillsLinkConfirmed =
            this.issuerSameAsPersonInLinkedJwt(
                issuerDid,
                loadedFulfillsJwt.claim,
                loadedFulfillsJwt.issuer
            )
      }
    } else if (fulfillsHandleId && isGlobalEndorserHandleId(fulfillsHandleId)) {
      // ... or pull the data from the DB from previously signed handle info
      const loadedFulfillsIdInfo = claimIdDataList.find(claimIdData => claimIdData.handleId === fulfillsHandleId)
      let loadedFulfillsJwt = loadedFulfillsIdInfo?.handleJwt
      if (loadedFulfillsJwt) {
        fulfillsHandleId = loadedFulfillsJwt.handleId
        claimFulfills = JSON.parse(loadedFulfillsJwt.claim)
        fulfillsType = claimFulfills?.['@type']
        fulfillsLinkConfirmed =
            this.issuerSameAsPersonInLinkedJwt(
                issuerDid,
                loadedFulfillsJwt.claim,
                loadedFulfillsJwt.issuer
            )
      }
    }

    /**
     *  Now record if the give is a part of a PlanAction.
     **/
    let fulfillsPlanLastClaimId
    let fulfillsPlanHandleId

    // first look for Plan in the direct fulfills
    if (claimFulfills?.['@type'] === 'PlanAction') {
      fulfillsPlanLastClaimId = fulfillsLastClaimId
      fulfillsPlanHandleId = fulfillsHandleId
    }
    // look for Plan in parentage, ie fulfilled item's object.isPartOf
    if (!fulfillsPlanLastClaimId && !fulfillsPlanHandleId) {
      const fulfillsPlanInfo =
        await this.retrieveClauseClaimAndIssuer(claimFulfills?.object?.isPartOf, claimIdDataList, 'PlanAction')
      fulfillsPlanLastClaimId = fulfillsPlanInfo?.clauseLastClaimId
      fulfillsPlanHandleId = fulfillsPlanInfo?.clauseHandleId
    }

    // look for Plan in parentage, ie fulfilled item's itemOffered.isPartOf
    if (!fulfillsPlanLastClaimId && !fulfillsPlanHandleId) {
      // not found yet, so check itemOffered.isPartOf
      const fulfillsPlanInfo =
          await this.retrieveClauseClaimAndIssuer(claimFulfills?.itemOffered?.isPartOf, claimIdDataList, 'PlanAction')
      fulfillsPlanLastClaimId = fulfillsPlanInfo?.clauseLastClaimId
      fulfillsPlanHandleId = fulfillsPlanInfo?.clauseHandleId
    }
    // now have fulfillsPlan IDs set if they exist

    /**
     * check all fulfills for any explicit markers for Trade or Donation
     **/
      // 3 possible values: true means a gift/donation, false means a trade, and null means unknown
    let giftNotTrade = null;

    let fulfillsArray = Array.isArray(claim.fulfills) ? claim.fulfills : [claim.fulfills]
    for (let fulfills of fulfillsArray) {
      if (fulfills?.['@type'] === 'TradeAction') {
        giftNotTrade = false
        break // stop because any trades make the whole thing a trade
      } else if (fulfills?.['@type'] === 'DonateAction') {
        giftNotTrade = true
        // ... but continue because even one TradeAction later makes the whole thing a trade
      }
    }

    const byRecipient = issuerDid == claim.recipient?.identifier

    // for the amount & unit, take the first object with both
    let claimAmountObject = claim.object
    if (Array.isArray(claim.object)) {
      if (claim.object.length === 0) {
        claimAmountObject = undefined
      } else {
        claimAmountObject = R.find(claimObj => claimObj.amountOfThisGood && claimObj.unitCode, claim.object)
        if (claim.object.length > 1) {
          embeddedResults.embeddedRecordWarning =
              (embeddedResults.embeddedRecordWarning || "")
              + " The 'object' field has many but only the first with amounts & units will be counted."
        }
      }
    }

    // for the description, take the current description or the first object with a description
    let claimDescription = claim.description
    if (!claimDescription) {
      claimDescription = claim.object?.description
      if (Array.isArray(claim.object)) {
        if (claim.object.length === 0) {
          claimDescription = undefined
        } else {
          claimDescription = R.find(claimObj => claimObj.description, claim.object)?.description
          if (claim.object.length > 1) {
            embeddedResults.embeddedRecordWarning =
                (embeddedResults.embeddedRecordWarning || "")
                + " The 'object' field has many but only the first with a description will be used."
          }
        }
      }
    }

    const amountConfirmed = byRecipient ? (claimAmountObject?.amountOfThisGood || 1) : 0

    const entry = {
      jwtId,
      handleId,
      issuedAt,
      updatedAt: issuedAt,
      issuerDid,
      agentDid: claim.agent?.identifier || issuerDid,
      recipientDid: claim.recipient?.identifier,
      fulfillsHandleId,
      fulfillsLastClaimId,
      fulfillsLinkConfirmed,
      fulfillsType,
      fulfillsPlanHandleId,
      fulfillsPlanLastClaimId,
      giftNotTrade,
      amount: claimAmountObject?.amountOfThisGood || 0,
      unit: claimAmountObject?.unitCode,
      description: claimDescription,
      amountConfirmed,
      fullClaim: canonicalize(claim),
    }

    if (isFirstClaimForHandleId) {
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
          await dbService.giveProviderInsert({
            giveHandleId: handleId,
            providerId: provider.identifier,
            linkConfirmed: provider.identifier === issuerDid,
          })
        }
      }
    }

    return R.mergeLeft(entry, embeddedResults)
  }


  async createEmbeddedClaimEntry(jwtId, issuerDid, issuedAt, handleId, claim, claimIdDataList, isFirstClaimForHandleId) {

    if (isContextSchemaOrg(claim['@context'])
        && claim['@type'] === 'AgreeAction') {

      // note that @type of 'Confirmation' does similar logic (but is deprecated)

      l.trace('Adding AgreeAction confirmation', claim)

      const recordings = []
      {
        const origClaim = claim['object']
        if (Array.isArray(origClaim)) {
          // deprecated; we recommend sending one confirmation at a time for easier checks when hashing content, making references, etc.

          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (let claim of origClaim) {
            // this must await (see note above)
            const conf = await this.createOneConfirmation(jwtId, issuerDid, issuedAt, claim, claimIdDataList)
                .catch(e => ({ embeddedRecordError: e }))
            recordings.push(conf)
          }
        } else if (origClaim) {
          // this must await (see note above)
          const conf = await this.createOneConfirmation(jwtId, issuerDid, issuedAt, origClaim, claimIdDataList)
            .catch(e => ({ embeddedRecordError: e }))
          recordings.push(conf)
        }
      }
      return { confirmations: recordings }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'GiveAction') {

      const newGive =
            await this.createGive(jwtId, issuerDid, issuedAt, handleId, claim, claimIdDataList, isFirstClaimForHandleId)

      // only update confirm totals if this is an update
      await this.checkOfferUpdate(
          issuerDid, issuedAt, newGive.recipientDid, newGive.unit, newGive.amount,
          newGive.fulfillsHandleId, newGive.fulfillsType, newGive.fulfillsPlanHandleId, false
      )

      l.trace(`${this.constructor.name} New give ${util.inspect(newGive)}`)
      return newGive

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'JoinAction') {

      // agent.did is for legacy data, some still in the mobile app
      const agentDid = claim.agent?.identifier || claim.agent?.did

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
        const eventId = await dbService.eventInsert(orgName, claim.event.name, claim.event.startTime)
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

      const actionId = await dbService.actionClaimInsert(issuerDid, agentDid, jwtId, event)
      l.trace(`${this.constructor.name} New action # ${actionId}`)
      return { actionId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Offer') {

      const isPartOfInfo =
          await this.retrieveClauseClaimAndIssuer(claim.itemOffered?.isPartOf, claimIdDataList, null, issuerDid)
      const fulfillsHandleId = isPartOfInfo?.clauseHandleId
      const fulfillsLastClaimId = isPartOfInfo?.clauseLastClaimId

      let fulfillsPlanHandleId, fulfillsPlanLastClaimId
      if (isPartOfInfo?.clauseClaim?.['@type'] === 'PlanAction') {
        fulfillsPlanHandleId = isPartOfInfo.clauseHandleId
        fulfillsPlanLastClaimId = isPartOfInfo.clauseLastClaimId
      }

      const fulfillsLinkConfirmed =
          this.issuerSameAsPersonInLinkedJwt(
              issuerDid,
              isPartOfInfo?.clauseClaim,
              isPartOfInfo?.clauseIssuerDid
          )

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const validTime = new Date(claim.validThrough)
      const validTimeStr =
        isNaN(validTime.getTime()) ? undefined : validTime.toISOString()

      const entry = {
        jwtId,
        handleId,
        issuedAt,
        updatedAt: issuedAt,
        issuerDid,
        offeredByDid: claim.offeredBy?.identifier || issuerDid,
        recipientDid: claim.recipient?.identifier,
        fulfillsHandleId,
        fulfillsLastClaimId,
        fulfillsLinkConfirmed: fulfillsLinkConfirmed ? 1 : 0,
        fulfillsPlanHandleId,
        fulfillsPlanLastClaimId,
        amount: claim.includesObject?.amountOfThisGood,
        unit: claim.includesObject?.unitCode,
        objectDescription: claim.itemOffered?.description,
        validThrough: validTimeStr,
        fullClaim: canonicalize(claim),
      }
      if (isFirstClaimForHandleId) {
        // new record
        const offerId = await dbService.offerInsert(entry)
        l.trace(`${this.constructor.name} New offer ${jwtId} ${util.inspect(entry)}`)
      } else {
        // edit existing record
        entry.updatedAt = new Date().toISOString()
        const numUpdated = await dbService.offerUpdate(entry)
        l.trace(`${this.constructor.name} Updated offer ${jwtId}, ${numUpdated} record(s): ${util.inspect(entry)}`)
      }
      return { offerId: jwtId }

    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'Organization'
               && claim.member
               && claim.member['@type'] === 'OrganizationRole'
               && claim.member.member.identifier) {

      const entry = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        orgName: claim.name,
        roleName: claim.member.roleName,
        startDate: claim.member.startDate,
        endDate: claim.member.endDate,
        memberDid: claim.member.member.identifier
      }
      const orgRoleId = await dbService.orgRoleInsert(entry)
      l.trace(`${this.constructor.name} New org role ${orgRoleId} ${util.inspect(entry)}`)
      return { orgRoleId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'PlanAction') {

      // note that this is similar to Project

      // agent.did is for legacy data, some still in the mobile app
      const agentDid = claim.agent?.identifier || claim.agent?.did

      const planFulfills =
        await this.retrieveClauseClaimAndIssuer(claim.fulfills, claimIdDataList, 'PlanAction', issuerDid)
      const fulfillsPlanHandleId = planFulfills?.clauseHandleId
      const fulfillsPlanLastClaimId = planFulfills?.clauseLastClaimId
      const fulfillsLinkConfirmed =
        this.issuerSameAsPersonInLinkedJwt(
            issuerDid,
            planFulfills?.clauseClaim,
            planFulfills?.clauseIssuerDid
        )

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const startTime = new Date(claim.startTime)
      const startTimeStr =
        isNaN(startTime.getTime()) ? undefined : startTime.toISOString()
      const endTime = new Date(claim.endTime)
      const endTimeStr =
        isNaN(endTime.getTime()) ? undefined : endTime.toISOString()

      let latitude
      if (claim.location?.geo?.['@type'] == 'GeoCoordinates'
          && claim.location?.geo?.latitude) {
        latitude = claim.location.geo.latitude
      }
      let longitude
      if (claim.location?.geo?.['@type'] == 'GeoCoordinates'
          && claim.location?.geo?.longitude) {
        longitude = claim.location.geo.longitude
      }

      const entry = {
        jwtId: jwtId,
        agentDid: agentDid,
        issuerDid: issuerDid,
        handleId: handleId,
        name: claim.name,
        description: claim.description,
        fulfillsLinkConfirmed: fulfillsLinkConfirmed,
        fulfillsPlanHandleId: fulfillsPlanHandleId,
        fulfillsPlanLastClaimId: fulfillsPlanLastClaimId,
        image: claim.image,
        endTime: endTimeStr,
        startTime: startTimeStr,
        locLat: latitude,
        locLon: longitude,
        resultDescription: claim.resultDescription,
        resultIdentifier: claim.resultIdentifier,
        url: claim.url,
      }

      const planRecord = await dbService.planInfoByHandleId(handleId)
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
      const agentDid = claim.agent?.identifier || claim.agent?.did

      // We'll put the given times into the DB but only if they're valid dates.
      // This also helps when JS parses but DB datetime() would not.
      const startTime = new Date(claim.startTime)
      const startTimeStr =
        isNaN(startTime.getTime()) ? undefined : startTime.toISOString()
      const endTime = new Date(claim.endTime)
      const endTimeStr =
        isNaN(endTime.getTime()) ? undefined : endTime.toISOString()

      let latitude
      if (claim.location?.geo?.['@type'] == 'GeoCoordinates'
          && claim.location?.geo?.latitude) {
        latitude = claim.location.geo.latitude
      }
      let longitude
      if (claim.location?.geo?.['@type'] == 'GeoCoordinates'
          && claim.location?.geo?.longitude) {
        longitude = claim.location.geo.longitude
      }

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
        locLat: latitude,
        locLon: longitude,
        resultDescription: claim.resultDescription,
        resultIdentifier: claim.resultIdentifier,
        url: claim.url,
      }

      const projectRecord = await dbService.projectInfoByHandleId(handleId)
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
      const agentDid = claim.agent?.identifier || claim.agent?.did || issuerDid

      if (agentDid != null && agentDid !== issuerDid) {
        return { embeddedRecordError: "You cannot claim an agent other than yourself as registrar." }
      }

      // participant.did is for legacy data, some still in the mobile app
      const participantDid = claim.participant?.identifier || claim.participant?.did

      if (!participantDid) {
        return { embeddedRecordError: "You did not send a participant's identifier for registration." }
      }

      const registration = {
        did: participantDid,
        agent: agentDid,
        epoch: Math.floor(new Date().valueOf() / 1000),
        jwtId: jwtId,
      }

      const registrationId = await dbService.registrationInsert(registration)
      l.trace(`${this.constructor.name} New registration ${registrationId} ${util.inspect(registration)}`)
      return { registrationId }

    } else if (claim['@context'] === 'https://endorser.ch'
               && claim['@type'] === 'Tenure') {

      // party.did is for legacy data, some still in the mobile app
      const partyDid = claim.party?.identifier || claim.party?.did

      const bbox = calcBbox(claim.spatialUnit.geo.polygon)
      const entry =
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

      const tenureId = await dbService.tenureInsert(entry)
      l.trace(`${this.constructor.name} New tenure ${tenureId} ${util.inspect(entry)}`)
      return { tenureId }


    } else if (isContextSchemaOrg(claim['@context'])
               && claim['@type'] === 'VoteAction') {

      const entry = {
        jwtId: jwtId,
        issuerDid: issuerDid,
        actionOption: claim.actionOption,
        candidate: claim.candidate,
        eventName: claim.object.event.name,
        eventStartTime: claim.object.event.startDate,
      }

      const voteId = await dbService.voteInsert(entry)
      l.trace(`${this.constructor.name} New vote ${voteId} ${util.inspect(entry)}`)
      return { voteId }


    } else if (isContextSchemaForConfirmation(claim['@context'])
               && claim['@type'] === 'Confirmation') {

      // this is for "legacy Confirmation" and can be deprecated; see AgreeAction

      const recordings = []

      { // handle a single claim
        const origClaim = claim['originalClaim']
        recordings.push(
          await this.createOneConfirmation(jwtId, issuerDid, issuedAt, origClaim, claimIdDataList)
            .catch(e => ({ embeddedRecordError: e }))
        )
      }

      { // handle multiple claims

        // deprecated; we recommend sending one confirmation at a time for easier checks when hashing content, making references, etc.

        const origClaims = claim['originalClaims']
        if (origClaims) {
          // if we run these in parallel then there can be duplicates
          // (when we haven't inserted previous ones in time for the duplicate check)
          for (let origClaim of origClaims) {
            recordings.push(
              await this.createOneConfirmation(jwtId, issuerDid, issuedAt, origClaim, claimIdDataList)
                .catch(e => ({ embeddedRecordError: e }))
            )
          }
        }
      }
      l.trace(`${this.constructor.name} Created ${recordings.length}`
              + ` confirmations & network records.`, recordings)

      const confirmations = await Promise.all(recordings)
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

  /**
   *
   * @param jwtId
   * @param issuerDid
   * @param issuedAt
   * @param handleId
   * @param claim
   * @param claimInfoList {ClaimInfo[]} list of objects for each claim referenced by claimId or handleId: {}
   * @param isFirstClaimForHandleId {boolean} true if this is the first claim for this handleId, important for determining insert vs update
   * @return Promise<Record< embeddedResults: string, networkResults: string >>
   */
  async createEmbeddedClaimEntries(jwtId, issuerDid, issuedAt, handleId, claim, claimIdDataList, isFirstClaimForHandleId) {

    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(${jwtId}, ${issuerDid}, ...)`);
    l.trace(`${this.constructor.name}.createEmbeddedClaimRecords(..., ${util.inspect(claim)})`);

    let embeddedResults
    if (Array.isArray(claim)) {

      return { clientError: 'We do not support sending multiple at once. Send individually.' }
      /**
      // Here's how we used to support an array of claims.
      // If you want this, you'll need to figure if and how to manage last claim IDs & handle IDs.

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
      // claim is not an array
      embeddedResults =
        await this.createEmbeddedClaimEntry(jwtId, issuerDid, issuedAt, handleId, claim, claimIdDataList, isFirstClaimForHandleId)
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

    return R.mergeLeft(embeddedResults, { networkResults: allNetRecords })
  }

  // see findAllLastClaimIdsAndHandleIds for the format of each claimInfo: { lastClaimId || handleId, suppliedType?, clause }
  //
  // return Promise of object with the lastClaimId's JWT loaded into the lastClaimJwt field,
  // or (if that doesn't exist) the handleId's JWT loaded into the handleJwt field
  //
  // The claim object is augmented with the following:
  // {
  //   lastClaimId: '01D25AVGQG1N8E9JNGK7C7DZRD' // if a system ID is supplied at any level in the claim
  //   lastClaimJwt: { CLAIM_JWT_RECORD } // if claimId is supplied
  //   handleId: 'http://endorser.ch/entry/01D25AVGQG1N8E9JNGK7C7DZRD', // if supplied in an "identifier" at any level in the claim
  //   handleJwt: { CLAIM_JWT_RECORD } // if handleId is supplied
  // }
  async loadClaimJwt(claimInfo) {
    if (claimInfo.lastClaimId) {
      // there's a claim ID which is local to this system
      const claimJwt = await dbService.jwtById(claimInfo.lastClaimId)
      if (!claimJwt) {
        const additionalInfo = isGlobalUri(claimInfo.lastClaimId)
          ? ' First import from the other system with a global "identifier" and then refer to that internal claim.'
          : ''
        throw `No claim found with lastClaimId ${claimInfo.lastClaimId}.` + additionalInfo
      }
      claimInfo.lastClaimJwt = claimJwt
      // we know every claim has a handleId
      claimInfo.handleId = claimJwt.handleId
    }
    if (isGlobalEndorserHandleId(claimInfo.handleId)) {
      const handleJwt = await dbService.jwtLastByHandleIdRaw(claimInfo.handleId)
      if (!handleJwt) {
        throw `No claim found with handleId ${claimInfo.handleId}`
      }
      claimInfo.handleJwt = handleJwt
    }
    return claimInfo
  }

  // return an error explanation for any JWTs where the data doesn't match
  gatherErrors(claim, claimInfoList) {
    const errors = []
    for (let claimInfo of claimInfoList) {
      if (claimInfo.lastClaimId
          && !claimInfo.lastClaimJwt) {
        // any local claimId should have a claimJwt
        errors.push(`The lastClaimId of ${claimInfo.lastClaimId} was not found in the database.`)
      }
      if (claimInfo.lastClaimId
          && claimInfo.clause.identifier
          && claimInfo.lastClaimJwt.handleId !== claimInfo.clause.identifier) {
        errors.push(`The lastClaimId of ${claimInfo.lastClaimId} has a handleId of ${claimInfo.lastClaimJwt.handleId} which doesn't match your supplied identifier of ${claimInfo.clause.identifier}.`)
      }
      if (!claimInfo.lastClaimId
          && (isGlobalEndorserHandleId(claimInfo.handleId) && !claimInfo.handleJwt)) {
        errors.push(`Without a lastClaimId, a handleId of ${claimInfo.handleId} for this system should be in the database but was not.`)
      }
      if (claimInfo.suppliedType
          && claimInfo.lastClaimJwt?.claimType
          && claimInfo.suppliedType !== claimInfo.lastClaimJwt.claimType) {
        errors.push(`The lastClaimId of ${claimInfo.lastClaimId} has a claimType of ${claimInfo.lastClaimJwt.claimType} which does not match the given claimType of ${claimInfo.suppliedType}`)
      }
      if (claimInfo.suppliedType
          && claimInfo.handleJwt?.claimType
          && claimInfo.suppliedType !== claimInfo.handleJwt.claimType) {
        errors.push(`The handleId of ${claimInfo.handleId} has a claimType of ${claimInfo.handleJwt.claimType} which does not match the given claimType of ${claimInfo.suppliedType}`)
      }
    }
    return errors
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
        await decodeAndVerifyJwt(jwtEncoded)
        .then((result) => {
          const { issuer, payload, verified } = result
          if (!verified) {
            return Promise.reject({
              clientError: {
                message: `Claim JWT verification failed.`,
                code: ERROR_CODES.JWT_VERIFY_FAILED
              }
            })
          }
          return result;
        })
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

        // disallow registering the same day they got registered
        const registeredDate = DateTime.fromSeconds(registered.epoch)
        if (DateTime.now().hasSame(registeredDate, 'day')) {
          return Promise.reject({ clientError: {
              message: `You cannot register anyone on the same day you got registered.`,
              code: ERROR_CODES.CANNOT_REGISTER_TOO_SOON
            }})
        }

        // during the first month, disallow registering more than one per day
        const startOfDayEpoch = DateTime.utc().startOf('day').toSeconds()
        const regCountToday = await dbService.registrationCountByAfter(payload.iss, startOfDayEpoch)
        if (DateTime.now().hasSame(registeredDate, 'month')
            && regCountToday > 0) {
          return Promise.reject({ clientError: {
            message: `You can only register one person per day during the first month.`,
            code: ERROR_CODES.OVER_REGISTRATION_LIMIT
          }})
        }

        // disallow registering above the monthly limit
        const startOfMonthEpoch = DateTime.utc().startOf('month').toSeconds()
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
      }

      // Now check that all claimId + handleId references are consistent.
      // We do this basic sanity check here because we want to fail before
      // storing the JWT and give the client an HTTP error code (rather than
      // a 201 result with an embeddedRecordError result).
      const claimIdsList = findAllLastClaimIdsAndHandleIds(payloadClaim)
      let claimIdDataList
      try {
        claimIdDataList = await Promise.all(R.map(this.loadClaimJwt, claimIdsList))
      } catch (err) {
        return Promise.reject({ clientError: { message: err } })
      }
      // If any of that data is not consistent, reject.
      const claimErrors = this.gatherErrors(payloadClaim, claimIdDataList)
      if (claimErrors.length > 0) {
        return Promise.reject({
          clientError: { message: claimErrors.join(' ') }
        })
      }

      // The following looks up a previous entry by handle ID, and if it exists
      // then we figure they want to replace it. However, it is more precise
      // and reliable if they use a specific record (a JWT ID via lastClaimId)
      // because it's possible for some synchronization problem where their system
      // or another authorized participant (the agent) has sent a change and they
      // haven't seen the most recent version... so they should avoid simply
      // sending a handle ID where we retrieve the latest -- and we
      // should require they point to the previous record, and notify
      // them if there is a more recent record with that same handle ID.

      // Generate the local id and find or generate the global "entity" handle ID.
      const jwtId = dbService.newUlid()

      const lastClaimId = payloadClaim.lastClaimId
      const lastClaimInfo =
          lastClaimId
              ? R.find(x => x.lastClaimId === lastClaimId, claimIdDataList)
              : null
      const lastClaimJwt = lastClaimInfo?.lastClaimJwt

      let handleId
      let isFirstClaimForHandleId = false // this is the first claim for this handleId, hard to derive because of handleIds from other systems
      if (lastClaimId) {

        // Check that the previous entry exists.
        if (!lastClaimJwt) {
          return Promise.reject(
            {
              clientError: {
                message: `If you supply a lastClaimId then it must have been sent earlier.`
              }
            }
          )
        }

        // The previous entry exists.
        // Check if the new context & type matches the old.
        if (payloadClaim["@context"] != lastClaimJwt.claimContext
            || payloadClaim["@type"] != lastClaimJwt.claimType) {
          return Promise.reject(
              {
                clientError: {
                  message: `You cannot change the context & type of an existing entry from ${lastClaimJwt.claimContext} & ${lastClaimJwt.claimType} to ${payloadClaim["@context"]} & ${payloadClaim["@type"]}.`
                }
              }
          )
        }

        // This handleId must have been set by the lastClaimId, so we can accept it because we've run checks for lastClaimId already.
        handleId = lastClaimJwt.handleId

        if (payload.iss == lastClaimJwt.issuer) {
          // The issuer is the same as the previous.
          // We're OK to continue.
        } else if (payload.iss == handleId) {
          // The issuer matches the global handle so they're the whole subject of the claim.
          // We're OK to continue.
        } else {
          // The issuer doesn't match the previous entry issuer or person record.
          // They likely shouldn't be allowed, but we'll allow if they're the agent.
          const prevClaim = JSON.parse(lastClaimJwt.claim)
          if (payload.iss == prevClaim.agent?.identifier) {
            // The issuer was assigned as an agent.
            // We're OK to continue.
          } else {
            // someday check other properties, eg 'member' in Organization (requiring a role check)
            return Promise.reject(
                {
                  clientError: {
                    message: `You cannot edit a claim if you did not create the original or get assigned as an agent.`
                  }
                }
            )
          }
        }

      } else if (payloadClaim.identifier) {
        // There is no lastClaimId but there's an identifier, so we need to run checks that they have permissions.

        // Check that the previous entry exists.
        if (isGlobalEndorserHandleId(payloadClaim.identifier) && !lastClaimInfo?.handleJwt) {
          return Promise.reject(
            {
              clientError: {
                message: `If you supply an Endorser identifier then it must have been sent earlier.`
              }
            }
          )
        }

        // This has an identifier so check the previous instance to see if they are allowed to edit.
        // (Is this redundant now that we've got lastClaimId?)
        // 'identifier' is a schema.org convention; may add others
        handleId =
          isGlobalUri(payloadClaim.identifier)
            ? payloadClaim.identifier
            : globalFromInternalIdentifier(payloadClaim.identifier)

        const prevEntry = await dbService.jwtLastByHandleIdRaw(handleId)
        if (prevEntry) {
          // There is a previous entry.

          // use that entry handleId, just in case this was a lastClaimId and the handleId is different
          handleId = prevEntry.handleId

          // check that the context nor type has changed
          if (payloadClaim["@context"] != prevEntry.claimContext
              || payloadClaim["@type"] != prevEntry.claimType) {
            return Promise.reject(
              { clientError: {
                  message: `You cannot change the type of an existing entry.`
                } }
            )
          }

          // check that the issuer matches
          if (payload.iss == prevEntry.issuer) {
            // The issuer is the same as the previous.
            // We're OK to continue.
          } else if (payload.iss == handleId) {
            // The issuer matches the global handle so they're the whole subject of the claim.
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
                  message: `You cannot use a local URI identifier if you did not create the original.`
                } }
              )
            }
          }
        } else {
          // no previous record with that handle exists
          if (isGlobalEndorserHandleId(payloadClaim.identifier)) {
            // Don't allow any global IDs for this server that weren't created by this server.
            return Promise.reject(
              {
                clientError: {
                  message:
                    `That references a identifier on this system that doesn't exist. You can use one the system created; you cannot set it on your own.`
                }
              }
            )
          } else if (!isGlobalUri(payloadClaim.identifier)) {
            // Don't allow any local IDs that weren't created by this server.
            // (If you allow this, ensure they can't choose any past or future jwtId.)
            return Promise.reject(
              {
                clientError: {
                  message:
                  `That references a local URI identifier that doesn't exist. You can use one the system created; you cannot set it on your own.`
                }
              }
            )
          } else {
            // It's a non-Endorser global URI that doesn't already exist. That's fine.
            isFirstClaimForHandleId = true
          }
        }

      } else {
        // There is no lastClaimId and no identifier.
        // Make the handleId from the jwtId.
        handleId = globalFromInternalIdentifier(jwtId)
        isFirstClaimForHandleId = true
      }

      const claimStr = canonicalize(payloadClaim)
      const jwtEntry = dbService.buildJwtEntry(
        payload, jwtId, lastClaimId, handleId, payloadClaim, claimStr, jwtEncoded
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
            jwtEntry.id, issuerDid, jwtEntry.issuedAt, handleId, payloadClaim, claimIdDataList, isFirstClaimForHandleId
          )
          .catch(err => {
            l.error(err, `Failed to create embedded claim records.`)
            return { embeddedRecordError: err }
          })

      const result = R.mergeLeft({ claimId: jwtEntry.id, handleId: handleId, hashNonce: jwtEntry.hashNonce }, embedded)
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
