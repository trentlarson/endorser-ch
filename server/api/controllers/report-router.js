import * as express from 'express'
import * as R from 'ramda'

import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

import ClaimService from '../services/claim.service'
import { dbService, MUST_FILTER_TOTALS_ERROR } from '../services/endorser.db.service';
import {globalId} from "../services/util";

class DbController {

  getAllJwtsPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.jwtsByParamsPaged(query, afterId, beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getAllIssuerClaimTypesPaged(req, res, next) {
    const claimTypes = JSON.parse(req.query.claimTypes)
    if (!Array.isArray(claimTypes)) {
      return res.status(400).json({error: "Parameter 'claimTypes' should be an array but got: " + req.query.claimTypes}).end()
    }
    dbService.jwtIssuerClaimTypesPaged(res.locals.tokenIssuer, claimTypes, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGivesForPlansPaged(req, res, next) {
    const planIdsParam = JSON.parse(req.query.planIds)
    if (!Array.isArray(planIdsParam)) {
      return res.status(400).json({
        error: "Parameter 'planIds' should be an array but got: "
          + req.query.planIdsParam
      }).end()
    }
    const planIds = planIdsParam.map(globalId)
    dbService.givesForPlansPaged(planIds, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveFulfillersToGive(req, res, next) {
    const handleId = req.query.giveHandleId
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.giveFulfillersToGive(handleId, afterId, beforeId)
        .then(results => ({
          data: results.data.map(datum =>
              R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
          ),
          hitLimit: results.hitLimit,
        }))
        .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveFulfillersToOffer(req, res, next) {
    const handleId = req.query.offerHandleId
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.giveFulfillersToOffer(handleId, afterId, beforeId)
        .then(results => ({
          data: results.data.map(datum =>
              R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
          ),
          hitLimit: results.hitLimit,
        }))
        .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGivesPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.givesByParamsPaged(query, afterId, beforeId)
      .then(results => ({
        data: results.data.map(
          datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveProviders(req, res, next) {
    const giveHandleId = req.query.giveHandleId
    dbService.giveProviderClaims(giveHandleId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGivesProvidedBy(req, res, next) {
    const providerId = globalId(req.query.providerId)
    dbService.givesProvidedBy(providerId, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
            R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveTotals(req, res, next) {
    const agentId = req.query.agentId
    const includeTrades = req.query.includeTrades
    const recipientId = req.query.recipientId
    const planId = globalId(req.query.planId)
    if (recipientId && recipientId != res.locals.tokenIssuer) {
      res.status(400).json({
        // see https://endorser.ch/doc/tasks.yaml#specific-searches-visible-if-allowed
        error: "Request for recipient totals can only be made by that recipient."
      }).end()
    } else if (agentId && agentId != res.locals.tokenIssuer) {
      res.status(400).json({
        // see https://endorser.ch/doc/tasks.yaml#specific-searches-visible-if-allowed
        error: "Request for agent totals can only be made by that agent."
      }).end()
    } else {
      const afterId = req.query.afterId
      const beforeId = req.query.beforeId
      const unit = req.query.unit
      dbService.giveTotals(agentId, recipientId, planId, unit, includeTrades, afterId, beforeId)
        .then(results => { res.json(results).end() })
        .catch(err => {
          if (err == MUST_FILTER_TOTALS_ERROR) {
            res.status(400).json({
              error: "Client must filter by plan or recipient when asking for totals."
            }).end()
          } else {
            console.error(err)
            res.status(500).json(""+err).end()
          }
        })
    }
  }

  getOffersForPlansPaged(req, res, next) {
    const planIdsParam = JSON.parse(req.query.planIds)
    if (!Array.isArray(planIdsParam)) {
      return res.status(400).json({error: "Parameter 'planIds' should be an array but got: " + planIdsParam}).end()
    }
    const planIds = planIdsParam.map(globalId)
    dbService.offersForPlansPaged(planIds, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getOffersPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.offersByParamsPaged(query, afterId, beforeId)
      .then(results => ({
        data: results.data.map(
          datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getOfferTotals(req, res, next) {
    const query = req.query
    const planId = globalId(req.query.planId)
    const recipientId = req.query.recipientId
    if (recipientId && recipientId != res.locals.tokenIssuer) {
      res.status(400).json({ error: "Request for recipient totals must be made by that recipient." }).end()
      return
    } else {
      const afterId = req.query.afterId
      const beforeId = req.query.beforeId
      const unit = req.query.unit
      dbService.offerTotals(planId, recipientId, unit, afterId, beforeId)
        .then(results => { res.json(results).end() })
        .catch(err => {
          if (err == MUST_FILTER_TOTALS_ERROR) {
            res.status(400).json(
              "Client must filter by plan or recipient when asking for totals."
            ).end()
          } else {
            console.error(err)
            res.status(500).json(""+err).end()
          }
        })
    }
  }

  getAllPlansPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.plansByParamsPaged(query, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlansByIssuerPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.plansByIssuerPaged(res.locals.tokenIssuer, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlansByLocationPaged(req, res, next) {
    const minLocLat = Number.parseFloat(req.query.minLocLat)
    const maxLocLat = Number.parseFloat(req.query.maxLocLat)
    const westLocLon = Number.parseFloat(req.query.westLocLon)
    const eastLocLon = Number.parseFloat(req.query.eastLocLon)
    dbService.plansByLocationPaged(
      minLocLat, maxLocLat, westLocLon, eastLocLon, req.query.afterId, req.query.beforeId
    )
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlanFulfilledBy(req, res, next) {
    const handleId = req.query.planHandleId
    dbService.planFulfilledBy(handleId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  /** jwtFulfillersToPlan not yet implemented
  getJwtFulfillersToPlan(req, res, next) {
    const handleId = req.query.planHandleId
    dbService.jwtFulfillersToPlan(handleId)
        .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }
  **/

  getPlanFulfillersToPlan(req, res, next) {
    const handleId = req.query.planHandleId
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.planFulfillersToPlan(handleId, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getAllProjectsPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.projectsByParamsPaged(query, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getProjectsByIssuerPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.projectsByIssuerPaged(res.locals.tokenIssuer, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getProjectsByLocationPaged(req, res, next) {
    const minLocLat = Number.parseFloat(req.query.minLocLat)
    const maxLocLat = Number.parseFloat(req.query.maxLocLat)
    const westLocLon = Number.parseFloat(req.query.westLocLon)
    const eastLocLon = Number.parseFloat(req.query.eastLocLon)
    dbService.projectsByLocationPaged(
      minLocLat, maxLocLat, westLocLon, eastLocLon, req.query.afterId, req.query.beforeId
    )
      .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getCanClaim(req, res) {
    dbService.registrationByDid(res.locals.tokenIssuer)
      .then(r => {
        const dataResult = { data: !!r }
        if (!r) {
          dataResult.error = "The person who referred you can register you."
        }
        return res.json(dataResult).end()
      })
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }

}
let dbController = new DbController();

class ServiceController {
  // get DIDs of those who have confirmed the given claim entries
  getConfirmerIds(req, res) {
    const claimEntryIds = req.body.claimEntryIds
    ClaimService.retrieveConfirmersForClaimsEntryIds(claimEntryIds)
        .then(results => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, results))
        .then(results => { res.json({ data: results }).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }
}
let serviceController = new ServiceController();

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
  })

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

/**
 * @typedef IdAndType
 * @property {string} id
 * @property {string} type
 */

/**
 * @typedef Give
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} agentId
 * @property {string} recipientDid
 * @property {string} fulfillsLastClaimId - last seen claim ID of the offer this fulfills
 * @property {string} fulfillsHandleId - handle ID of the offer this fulfills
 * @property {string} fulfillsType - type of the element this fulfills, usually "Offer"
 * @property {string} fulfillsPlanLastClaimId - last seen claim ID of the plan, if the give applies to one
 * @property {string} fulfillsPlanHandleId - handle ID of the plan, if the give applies to one
 * @property {string} unit
 * @property {number} amount
 * @property {number} amountConfirmed - amount of this that recipient has confirmed
 * @property {string} description
 * @property {object} fullClaim
 * @property {array.IdAndType} providers, where id is the handle ID of the provider; can be sent as inputs, but are retrieved through different endpoints
 * @see /giveProviders
 */

/**
 * @typedef GiveArrayMaybeMoreBody
 * @property {array.Give} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef Jwt
 * @property {string} id
 * @property {datetime} issuedAt
 * @property {string} issuer
 * @property {string} subject
 * @property {string} claimContext
 * @property {string} claimType
 * @property {object} claim
 * @property {string} hashHex
 * @property {string} hashChainHex
 */

/**
 * @typedef JwtArrayMaybeMoreBody
 * @property {array.Jwt} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef Offer
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} offeredByDid
 * @property {string} recipientDid - recipient DID if this is for a plan
 * @property {string} recipientPlanId - plan handle ID if this is for a plan
 * @property {string} unit
 * @property {number} amount
 * @property {number} amountGiven - amount of Gives to this Offer
 * @property {number} amountGivenConfirmed - amount of Gives confirmed by recipient
 * @property {string} objectDescription
 * @property {datetime} validThrough
 * @property {object} fullClaim
 */

/**
 * @typedef OfferArrayMaybeMoreBody
 * @property {array.Offer} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef Plan
 * @property {string} jwtId
 * @property {string} agentDid
 * @property {string} description
 * @property {datetime} endTime
 * @property {boolean} fulfillsLinkConfirmed
 * @property {string} fulfillsPlanClaimId - claim ID of the plan, if the plan applies to one
 * @property {string} fulfillsPlanHandleId - handle ID of the plan, if the plan applies to one
 * @property {string} image
 * @property {string} issuerDid
 * @property {string} handleId
 * @property {float} locLat
 * @property {float} locLon
 * @property {string} name
 * @property {datetime} startTime
 * @property {string} resultDescription
 * @property {string} resultIdentifier
 * @property {string} url
 */

/**
 * @typedef PlanWithFulfilledLinkConfirmation
 * @property {Plan} data (as many as allowed by our limit)
 * @property {boolean} childFullfillsLinkConfirmed true when the link between plans has been confirmed by both
 */

/**
 * @typedef PersonLink
 * @Property {string} identifier DID
 * @Property {boolean} linkConfirmed
 */

/**
 * Get all claims for the query inputs, paginated, reverse-chronologically
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/claims
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {JwtArrayMaybeMoreBody} 200 - 'data' property with matching array of Jwt entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claims', dbController.getAllJwtsPaged)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @returns {JwtArrayMaybeMoreBody} 200 - 'data' property with array of Jwt claims issued by this user with any of those claim types, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypesPaged)

/**
 * Check if current user can create a claim.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/canClaim
 * @returns {object} 200 - 'data' boolean property tells whether this user is allowed to create a claim
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canClaim', dbController.getCanClaim)

/**
 * Retrieve all confirmers for a set of claims. (Same as POST version, just like Elasticsearch.)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/confirmers
 * @param {array} claimEntryIds.body.required the claim JWT IDs, for whose confirmers I want to find
 * @returns {object} 200 - 'data' array of IDs who have confirmed given claims
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/confirmers', serviceController.getConfirmerIds)

/**
 * Retrieve all confirmers for a set of claims. (Same as GET version, just like Elasticsearch.)
 *
 * @group reports - Reports (with paging)
 * @route POST /api/v2/report/confirmers
 * @param {array} claimEntryIds.body.required the claim JWT IDs, for whose confirmers I want to find
 * @returns {object} 200 - 'data' array of IDs who have confirmed given claims
 * ... and, yes, a 200 is weird for a POST, but this is just for convenience and a GET is recommended anyway
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/confirmers', serviceController.getConfirmerIds)

/**
 * Search gives
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/gives
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} agentId.query.optional - issuing agent
 * @param {string} handleId.query.optional - persistent handleId
 * @param {string} recipientId.query.optional - recipient
 * @param {string} fulfillsHandleId.query.optional - for ones that fulfill a particular item (eg. an offer)
 * @param {string} fulfillsType.query.optional - for ones that fulfill a particular type
 * @returns {GiveArrayMaybeMoreBody} 200 - 'data' property with matching array of Give entries, reverse chronologically;
 *  'hitLimit' boolean property if there may be more;
 *  but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/gives', dbController.getGivesPaged)

/**
 * Get gives dedicated to any in a list of plan IDs
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givesForPlans
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - JSON.stringified array with handle IDs of the plans which have received gives
 * @returns {GiveArrayMaybeMoreBody} 200 - 'data' property with matching array of Give entries, reverse chronologically;
 *   'hitLimit' boolean property if there may be more;
 *   but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/givesToPlans', dbController.getGivesForPlansPaged)
  // This endpoint can be removed when Time Safari code is updated.
  .get('/givesForPlans', dbController.getGivesForPlansPaged)

/**
 * Get give fulfilled by this give
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveFulfilledByGive
 * @param {string} giveHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @returns {GiveWithFulfilledLinkConfirmation} 200 - 'data' property with Plan entry and flag indicating whether the fulfill relationship is confirmed
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
// (not yet implemented)
//  .get('/giveFulfilledByGive', dbController.getGiveFulfilledBy)

/**
 * Get Give fulfillers for a particular Give
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveFulfillersToGive
 * @param {string} giveHandleId.query.required - the handleId of the give entry
 * @returns {GiveArrayMaybeMoreBody} 200 - 'data' property with each of the fulfillers, reverse chronologically;
 * 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveFulfillersToGive', dbController.getGiveFulfillersToGive)

/**
 * Get Give fulfillers for a particular Offer
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givefulfillersToOffer
 * @param {string} giveHandleId.query.required - the handleId of the give entry
 * @returns {GiveArrayMaybeMoreBody} 200 - 'data' property with each of the fulfillers, reverse chronologically;
 * 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveFulfillersToOffer', dbController.getGiveFulfillersToOffer)

/**
 * Get gives provided by this provider
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givesProvidedBy
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} providerId.query.optional - handle ID of the provider which may have helped with gives
 * @returns {GiveArrayMaybeMoreBody} 200 - 'data' property with matching array of Give entries, reverse chronologically;
 * 'hitLimit' boolean property if there may be more;
 * but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/givesProvidedBy', dbController.getGivesProvidedBy)

/**
 * Get totals of gives
 *
 * I agonized over the includeTrades. There's a perspective that, by default, this endpoint should retrieve all the give
 * activity. However, the vision of this service is to focus on the Give Economy, and not the Trade Economy, and so the
 * default behavior is to focus only on the gives. I'm only including the possibility for trades to be included because
 * this service is still fairly open-ended and we'll allow that use-case for now; this flag will allow us to detect
 * other uses and provide helpful messages if we stop supporting this kind of usage in the future.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveTotals
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} includeTrades.query.optional - doesn't include trades by default, so set this to 'true' to include them -- see above for more details on this design
 * @param {string} planId.query.optional - handle ID of the plan which has received gives
 * @param {string} recipientId.query.optional - DID of recipient who has received gives
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {object} 200 - 'data' property with keys being units and values being the number amounts of total gives for them
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveTotals', dbController.getGiveTotals)

/**
 * Search offers
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offers
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} handleId.query.optional - persistent ID of offer
 * @param {string} offeredByDid.query.optional - originator of offer
 * @param {string} recipientPlanId.query.optional - plan which is recipient of offer
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @param {string} validThrough.query.optional - date up to which offers are valid
 * @returns {OfferArrayMaybeMoreBody} 200 - 'data' property with matching array of Offer entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offers', dbController.getOffersPaged)

/**
 * Get offers dedicated to any in a list of plan IDs
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offersToPlans
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - handle ID of the plan which has received offers
 * @returns {OfferArrayMaybeMoreBody} 200 - 'data' property with matching array of Offer entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offersToPlans', dbController.getOffersForPlansPaged)

/**
 * Get totals of offers
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offerTotals
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planId.query.optional - handle ID of the plan which has received offers
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {object} 200 - 'data' property with keys being units and values being the number amounts of total offers for them
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offerTotals', dbController.getOfferTotals)

/**
 * Get all plans for the query inputs, paginated, reverse-chronologically
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plans
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} jwtId.query.optional
 * @param {string} issuerDid.query.optional
 * @param {string} agentDid.query.optional
 * @param {string} handleId.query.optional
 * @param {string} internalId.query.optional
 * @param {string} description.query.optional
 * @param {string} endTime.query.optional
 * @param {string} startTime.query.optional
 * @param {string} resultIdentifier.query.optional
 * @returns {PlanArrayMaybeMoreBody} 200 - 'data' property with matching array of Plan entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plans', dbController.getAllPlansPaged)

/**
 * Get all plans by the issuer, paginated, reverse-chronologically
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plansByIssuer
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanArrayMaybeMoreBody} 200 - 'data' property with matching array of Plan entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByIssuer', dbController.getPlansByIssuerPaged)

/**
 * Get all plans that have a location in the bbox specified, paginated, reverse-chronologically
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plansByLocation
 * @param {string} minLat.query.required - minimum latitude in degrees of bounding box being searched
 * @param {string} maxLat.query.required - maximum latitude in degrees of bounding box being searched
 * @param {string} westLon.query.required - minimum longitude in degrees of bounding box being searched
 * @param {string} eastLon.query.required - maximum longitude in degrees of bounding box being searched
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanArrayMaybeMoreBody} 200 - 'data' property with matching array of Plan entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByLocation', dbController.getPlansByLocationPaged)

/**
 * Get plan fulfilled by given plan
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/planFulfilledByPlan
 * @param {string} planHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @returns {PlanWithFulfilledLinkConfirmation} 200 - 'data' property with Plan entry and flag indicating whether the fulfill relationship is confirmed
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/planFulfilledByPlan', dbController.getPlanFulfilledBy)

/**
 * Get plans that fulfill given plan
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/fulfillersToPlan
 * @param {string} planHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanArrayMaybeMoreBody} 200 - 'data' property with matching array of Plan entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/planFulfillersToPlan', dbController.getPlanFulfillersToPlan)

/**
 * Get providers for a particular give
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/providersToGive
 * @param {string} giveHandleId.query.optional - the jwtId of the give entry
 * @returns {array.PersonLink} 200 - 'data' property with each of the providers with known types
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/providersToGive', dbController.getGiveProviders)
