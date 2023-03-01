import * as express from 'express'
import * as R from 'ramda'

import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'

import { dbService, MUST_FILTER_TOTALS_ERROR } from '../services/endorser.db.service';

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
    const planIds = JSON.parse(req.query.planIds)
    if (!Array.isArray(planIds)) {
      return res.status(400).json({
        error: "Parameter 'planIds' should be an array but got: "
          + req.query.planIds
      }).end()
    }
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

  getGiveTotals(req, res, next) {
    const agentId = req.query.agentId
    const recipientId = req.query.recipientId
    const planId = req.query.planId
    if (recipientId && recipientId != res.locals.tokenIssuer) {
      res.status(400).json({
        // see https://endorser.ch/doc/tasks.yaml#specific-searches-visible-if-allowed
        error: "Request for recipient totals must be made by that recipient."
      }).end()
      return
    } else {
      const afterId = req.query.afterId
      const beforeId = req.query.beforeId
      const unit = req.query.unit
      dbService.giveTotals(agentId, recipientId, planId, unit, afterId, beforeId)
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

  getOffersForPlansPaged(req, res, next) {
    const planIds = JSON.parse(req.query.planIds)
    if (!Array.isArray(planIds)) {
      return res.status(400).json({error: "Parameter 'planIds' should be an array but got: " + req.query.planIds}).end()
    }
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
    const planId = req.query.planId
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
 * @typedef Give
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} agentId
 * @property {string} recipientDid
 * @property {string} fulfillsId
 * @property {string} fulfillsType
 * @property {string} fulfillsPlanId
 * @property {string} amount
 * @property {object} unit
 * @property {string} description
 * @property {object} fullClaim
 */

/**
 * @typedef GiveArrayMaybeMoreBody
 * @property {Array.Offer} data (as many as allowed by our limit)
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
 * @property {Array.Jwt} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef Offer
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} offeredByDid
 * @property {string} recipientDid
 * @property {string} recipientPlanId
 * @property {string} amount
 * @property {object} unit
 * @property {string} objectDescription
 * @property {datetime} validThrough
 * @property {object} fullClaim
 */

/**
 * @typedef OfferArrayMaybeMoreBody
 * @property {Array.Offer} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef Plan
 * @property {string} jwtId
 * @property {string} issuerDid
 * @property {string} agentDid
 * @property {string} handleId
 * @property {string} name
 * @property {string} description
 * @property {string} image
 * @property {string} endTime
 * @property {datetime} endTime
 * @property {datetime} startTime
 * @property {string} resultDescription
 * @property {string} resultIdentifier
 */

/**
 * @typedef PlanArrayMaybeMoreBody
 * @property {Array.Plan} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * Check if current user can create a claim.
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/canClaim
 * @returns {Object} 200 - data boolean property tells whether this user is allowed to create a claim
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canClaim', dbController.getCanClaim)

/**
 * Get all claims for the query inputs, paginated, reverse-chronologically
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/claims
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {JwtArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claims', dbController.getAllJwtsPaged)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, but can include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @returns {JwtArrayMaybeMoreBody} 200 - claims issued by this user with any of those claim types, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypesPaged)

/**
 * Search gives
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/gives
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} claimContext.query.optional - search description of item given
 * @param {string} recipientId.query.optional - gives for recipient
 * @param {string} fulfillsId.query.optional - gives that apply to a particular item (eg. an offer)
 * @returns {GiveArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/gives', dbController.getGivesPaged)

/**
 * Get totals of gives
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/getGivesForPlans
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - handle ID of the plan which has received gives
 * @returns {GiveArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/givesForPlans', dbController.getGivesForPlansPaged)

/**
 * Get totals of gives
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/giveTotals
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planId.query.optional - handle ID of the plan which has received gives
 * @param {string} recipientId.query.optional - DID of recipient who has received gives
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {Object} 200 - keys are units and values are number amounts of total gives for them
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveTotals', dbController.getGiveTotals)

/**
 * Search offers
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/offers
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} claimContext.query.optional - search description of item offered
 * @param {string} recipientPlanId.query.optional - get offers associated with plan
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @returns {OfferArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offers', dbController.getOffersPaged)

/**
 * Get totals of offers
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/getOffersForPlans
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - handle ID of the plan which has received offers
 * @returns {OfferArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offersForPlans', dbController.getOffersForPlansPaged)

/**
 * Get totals of offers
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/offerTotals
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planId.query.optional - handle ID of the plan which has received offers
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {Object} 200 - keys are units and values are number amounts of total offers for them
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offerTotals', dbController.getOfferTotals)

/**
 * Get all plans for the query inputs, paginated, reverse-chronologically
 *
 * @group reportAll - Reports With Paging
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
 * @returns {PlanArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plans', dbController.getAllPlansPaged)

/**
 * Get all plans by the issuer, paginated, reverse-chronologically
 *
 * @group reportAll - Reports With Paging
 * @route GET /api/v2/report/plansByIssuer
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, but can include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanArrayMaybeMoreBody} 200 - matching entries, reverse-chronologically
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByIssuer', dbController.getPlansByIssuerPaged)
