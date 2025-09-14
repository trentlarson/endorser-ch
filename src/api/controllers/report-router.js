import * as express from 'express'
import * as R from 'ramda'

import {
  hideDidsAndAddLinksToNetwork,
  hideDidsAndAddLinksToNetworkInDataKey
} from '../services/util-higher'

import ClaimService from '../services/claim.service'
import { dbService } from '../services/endorser.db.service';
import { planService } from '../services/project.service';
import { globalId, latLonFromTile, latWidthToTileWidth } from "../services/util";

// Why does it not work to put this in the class?
// When it's in the class, "this" is undefined so "this.getGiveTotalsMaybeGifted" fails when called.
// Without "this." I get: "ReferenceError: getGiveTotalsMaybeGifted is not defined"
function getGiveTotalsMaybeGifted(req, res, next, onlyGifted) {
  const agentDid = req.query.agentDid
  const onlyTraded = req.query.onlyTraded === "true"
  const recipientId = req.query.recipientId
  const planId = req.query.planHandleId || globalId(req.query.planId)
  if (recipientId && recipientId != res.locals.authTokenIssuer) {
    res.status(400).json({
      // see https://endorser.ch/doc/tasks.yaml#specific-searches-visible-if-allowed
      error: "Request for recipient totals can only be made by that recipient."
    }).end()
  } else if (agentDid && agentDid != res.locals.authTokenIssuer) {
    res.status(400).json({
      // see https://endorser.ch/doc/tasks.yaml#specific-searches-visible-if-allowed
      error: "Request for agent totals can only be made by that agent."
    }).end()
  } else {
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    const unit = req.query.unit
    dbService.giveTotals(agentDid, recipientId, planId, unit, onlyGifted, onlyTraded, afterId, beforeId)
    .then(results => { res.json(results).end() })
    .catch(err => {
      if (err == dbService.MUST_FILTER_TOTALS_ERROR) {
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

function retrievePlansLastUpdateBetween(planIds, afterId, beforeId, req, res) {
  if (!planIds || !Array.isArray(planIds)) {
    return res.status(400).json({ error: 'planIds array parameter is required' })
  }
  if (!afterId) {
    return res.status(400).json({ error: 'afterId parameter is required' })
  }
  if (planIds.length === 0) {
    return res.json({ data: [], hitLimit: false }).end()
  }
  dbService.plansLastUpdatedBetween(planIds, afterId, beforeId)
    .then(planResults => {
      // look up earlier JWT claim for each plan that was found
      if (planResults.data.length === 0) {
        return { data: [], hitLimit: false }
      }
      return dbService.jwtsMostRecentForPlansBefore(planResults.data.map(datum => datum.handleId), afterId)
        .then(jwtResults => {
          return planResults.data.map(datum => {
            const claimBefore = jwtResults.data.find(jwt => jwt.handleId === datum.handleId);
            if (claimBefore) {
              claimBefore.claim = JSON.parse(claimBefore.claim);
            }
            return {
              plan: datum,
              wrappedClaimBefore: claimBefore
            }
          })
        })
        .then(allResults => ({ data: allResults, hitLimit: planResults.hitLimit }))
        // uncomment the following to see the full results
        // .then(results => {
        //   console.log('retrievePlansLastUpdateBetween full results', results, JSON.stringify(results, null, 2))
        //   return results
        // })
    })
    .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
    .then(results => { res.json(results).end() })
    .catch(err => { console.error(err); res.status(500).json(""+err).end() })
}

class DbController {

  getAllJwtsPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    const searchTermMaybeDIDs = [req.query.claimContents, req.query.issuer, req.query.subject, req.query.handleId]
    dbService.jwtsByParamsPaged(query, afterId, beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results,  searchTermMaybeDIDs))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getAllIssuerClaimTypesPaged(req, res, next) {
    const claimTypes = JSON.parse(req.query.claimTypes)
    if (!Array.isArray(claimTypes)) {
      return res.status(400).json({error: "Parameter 'claimTypes' should be an array but got: " + req.query.claimTypes}).end()
    }
    dbService.jwtIssuerClaimTypesPaged(res.locals.authTokenIssuer, claimTypes, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum => R.set(R.lensProp('claim'), JSON.parse(datum.claim), datum)),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiftedTotals(req, res, next) {
    getGiveTotalsMaybeGifted(req, res, next, true);
  }

  getGivesToPlansPaged(req, res, next) {
    const planIdsParam = req.query.handleIds || req.query.planHandleIds || req.query.planIds
    const planIdsParsed = JSON.parse(planIdsParam)
    if (!Array.isArray(planIdsParsed)) {
      return res.status(400).json({
        error: "Parameter 'handleIds' or 'planHandleIds' or 'planIds' should be an array but got: "
          + planIdsParsed
      }).end()
    }
    const planIds = planIdsParsed.map(globalId)
    dbService.givesToPlansPaged(planIds, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results =>
        hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, [])
      )
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveFulfillersToGive(req, res, next) {
    const handleId = req.query.handleId || req.query.giveHandleId || globalId(req.query.giveId)
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.giveFulfillersToGive(handleId, afterId, beforeId)
        .then(results => ({
          data: results.data.map(datum =>
              R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
          ),
          hitLimit: results.hitLimit,
        }))
        .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveFulfillersToOffer(req, res, next) {
    const handleId = req.query.handleId || req.query.offerHandleId || globalId(req.query.offerId)
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.giveFulfillersToOffer(handleId, afterId, beforeId)
        .then(results => ({
          data: results.data.map(datum =>
              R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
          ),
          hitLimit: results.hitLimit,
        }))
        .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
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
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveProviders(req, res, next) {
    const giveHandleId = req.query.handleId || req.query.giveHandleId || globalId(req.query.giveId)
    dbService.giveProviderIds(giveHandleId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGivesProvidedBy(req, res, next) {
    const providerId = req.query.handleId || req.query.providerHandleId || globalId(req.query.providerId)
    dbService.givesProvidedBy(providerId, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
            R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getGiveTotals(req, res, next) {
    // The "giftNotTrade" flag is deprecated. (It's potentially confusing.) Use "onlyGifted". Remove after, say, 2025.
    const onlyGifted = req.query.onlyGifted ?? req.query.giftNotTrade
    getGiveTotalsMaybeGifted(req, res, next, onlyGifted === "true");
  }

  getOffersForPlansPaged(req, res, next) {
    const planIdsParam = req.query.handleIds || req.query.planHandleIds || req.query.planIds
    const planIdsParsed = JSON.parse(planIdsParam)
    if (!Array.isArray(planIdsParsed)) {
      return res.status(400).json({error: "Parameter 'handleIds' or 'planHandleIds' or 'planIds' should be an array but got: " + planIdsParsed}).end()
    }
    const planIds = planIdsParsed.map(globalId)
    dbService.offersForPlansPaged(planIds, req.query.afterId, req.query.beforeId)
      .then(results => ({
        data: results.data.map(datum =>
          R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
        ),
        hitLimit: results.hitLimit,
      }))
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getOffersForPlanOwnerPaged(req, res, next) {
    dbService.offersForPlanOwnerPaged(res.locals.authTokenIssuer, req.query.afterId, req.query.beforeId)
    .then(results => ({
      data: results.data.map(datum =>
        R.set(R.lensProp('fullClaim'), JSON.parse(datum.fullClaim), datum)
      ),
      hitLimit: results.hitLimit,
    }))
    .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
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
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getOfferTotals(req, res, next) {
    const planId = req.query.handleId || req.query.planHandleId || globalId(req.query.planId)
    const recipientId = req.query.recipientId
    if (recipientId && recipientId != res.locals.authTokenIssuer) {
      res.status(400).json({ error: "Request for recipient totals must be made by that recipient." }).end()
      return
    } else {
      const afterId = req.query.afterId
      const beforeId = req.query.beforeId
      const unit = req.query.unit
      dbService.offerTotals(planId, recipientId, unit, afterId, beforeId)
        .then(results => { res.json(results).end() })
        .catch(err => {
          if (err == dbService.MUST_FILTER_TOTALS_ERROR) {
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
    
    // Check if planHandleIds parameter is provided
    if (query.planHandleIds) {
      try {
        let planHandleIds
        try {
          planHandleIds = JSON.parse(query.planHandleIds)
        } catch (error) {
          return res.status(400).json({ error: ""+error }).end()
        }
        
        if (!Array.isArray(planHandleIds)) {
          return res.status(400).json({ error: 'planHandleIds must be a JSON array' })
        }

        // Check if other query parameters are present (excluding planHandleIds)
        const otherParams = Object.keys(query).filter(key => key !== 'planHandleIds')
        let resultWarning = null
        if (otherParams.length > 0) {
          resultWarning = "Only planHandleIds were searched and no other query criteria was used"
        }

        planService
          .infoByHandleIds(planHandleIds)
          .then(results => {
            // Apply hideDidsAndAddLinksToNetwork to each result
            const processedResults = results.data.map(result =>
              hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, [])
            )
            return Promise.all(processedResults).then(processed => ({
              data: processed,
              hitLimit: results.hitLimit
            }))
          })
          .then(processedResults => {
            const response = { data: processedResults.data }
            if (processedResults.hitLimit) {
              response.hitLimit = processedResults.hitLimit
            }
            if (resultWarning) {
              response.resultWarning = resultWarning
            }
            res.json(response)
          })
          .catch(err => {
            console.log(err);
            res.status(500).json(""+err).end();
          })
      } catch (error) {
        console.error(error)
        return res.status(500).json(""+error).end()
      }
    } else {
      // Original logic for regular plan queries
      const afterId = req.query.afterId
      delete query.afterId
      const beforeId = req.query.beforeId
      delete query.beforeId
      dbService.plansByParamsPaged(query, afterId, beforeId)
        .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
    }
  }

  getPlanCountsByBBox(req, res, next) {
    const minLocLat = Number.parseFloat(req.query.minLocLat)
    const maxLocLat = Number.parseFloat(req.query.maxLocLat)
    let minLocLon = Number.parseFloat(req.query.minLocLon)
    let maxLocLon = Number.parseFloat(req.query.maxLocLon)
    // allowing this old usage, replaced as of 4.2.0
    if (isNaN(minLocLon)) {
      minLocLon = Number.parseFloat(req.query.westLocLon)
    }
    if (isNaN(maxLocLon)) {
      maxLocLon = Number.parseFloat(req.query.eastLocLon)
    }

    if (isNaN(minLocLat) || isNaN(maxLocLat) || isNaN(minLocLon) || isNaN(maxLocLon)) {
      return res.status(400).json({ error: "Query parameters 'minLocLat', 'maxLocLat', 'minLocLon', and 'maxLocLon' must be numbers" }).end()
    }

    const tileWidth = latWidthToTileWidth(maxLocLat - minLocLat)
    // find the latitude that is a multiple of tileWidth and is closest to but below the minLocLat
    const minLatTile = Math.floor(minLocLat / tileWidth) * tileWidth
    // find the longitude that is a multiple of tileWidth and is closest to but west of the westLocLon
    const minLonTile = Math.floor(minLocLon / tileWidth) * tileWidth
    // find how many tiles wide the bounding box is
    const numTilesWide = Math.ceil((maxLocLon - minLonTile) / tileWidth)
    // calculate the maximum latitude with that many tiles
    const maxLatTiled = minLatTile + numTilesWide * tileWidth
    // calculate the maximum longitude with that many tiles
    const maxLonTiled = minLonTile + numTilesWide * tileWidth
    dbService.planCountsByBBox(minLocLat, minLocLon, maxLatTiled, maxLonTiled, numTilesWide)
      .then(results => ({ data: {
        tiles: results.map(latLonFromTile(minLocLat, minLocLon, tileWidth)),
        minGridLat: minLocLat,
        minGridLon: minLocLon,
        tileWidth: tileWidth,
        numTilesWide: numTilesWide
      } }) )
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlansByIssuerPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.plansByIssuerPaged(res.locals.authTokenIssuer, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlansByLocationAndContentsPaged(req, res, next) {
    const minLocLat = Number.parseFloat(req.query.minLocLat)
    const maxLocLat = Number.parseFloat(req.query.maxLocLat)
    let minLocLon = Number.parseFloat(req.query.minLocLon)
    let maxLocLon = Number.parseFloat(req.query.maxLocLon)
    // allowing this old usage, replaced as of 4.2.0
    if (isNaN(minLocLon)) {
      minLocLon = Number.parseFloat(req.query.westLocLon)
    }
    if (isNaN(maxLocLon)) {
      maxLocLon = Number.parseFloat(req.query.eastLocLon)
    }
    dbService.plansByLocationAndContentsPaged(
      minLocLat, maxLocLat, minLocLon, maxLocLon,
      req.query.afterId, req.query.beforeId, req.query.claimContents
    )
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getPlanFulfilledBy(req, res, next) {
    const handleId = req.query.handleId || req.query.planHandleId || globalId(req.query.planId)
    dbService.planFulfilledBy(handleId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  /** jwtFulfillersToPlan not yet implemented
  getJwtFulfillersToPlan(req, res, next) {
    const handleId = req.query.planHandleId
    dbService.jwtFulfillersToPlan(handleId)
        .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
        .then(results => { res.json(results).end() })
        .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }
  **/

  getPlanFulfillersToPlan(req, res, next) {
    const handleId = req.query.handleId || req.query.planHandleId || globalId(req.query.planId)
    const afterId = req.query.afterId
    const beforeId = req.query.beforeId
    dbService.planFulfillersToPlan(handleId, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }


  getPlansLastUpdatedBetweenFromPost(req, res, next) {
    const { planIds, afterId, beforeId } = req.body
    retrievePlansLastUpdateBetween(planIds, afterId, beforeId, req, res)
  }

  getPlansLastUpdatedBetweenFromGet(req, res, next) {
    const { planIds, afterId, beforeId } = req.query
    if (!planIds) {
      return res.status(400).json({ error: 'planIds JSONified array parameter is required' })
    }
    let planIdsArray = []
    try {
      // Parse projectIds from query string (comma-separated)
      planIdsArray = JSON.parse(planIds)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid planIds format. Should be a JSON array of strings.' })
    }
    retrievePlansLastUpdateBetween(planIdsArray, afterId, beforeId, req, res)
  }

  getAllProjectsPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.projectsByParamsPaged(query, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getProjectsByIssuerPaged(req, res, next) {
    const query = req.query
    const afterId = req.query.afterId
    delete query.afterId
    const beforeId = req.query.beforeId
    delete query.beforeId
    dbService.projectsByIssuerPaged(res.locals.authTokenIssuer, afterId, beforeId)
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getProjectsByLocationPaged(req, res, next) {
    const minLocLat = Number.parseFloat(req.query.minLocLat)
    const maxLocLat = Number.parseFloat(req.query.maxLocLat)
    let minLocLon = Number.parseFloat(req.query.minLocLon)
    let maxLocLon = Number.parseFloat(req.query.maxLocLon)
    // allowing this old usage, replaced as of 4.2.0
    if (isNaN(minLocLon)) {
      minLocLon = Number.parseFloat(req.query.westLocLon)
    }
    if (isNaN(maxLocLon)) {
      maxLocLon = Number.parseFloat(req.query.eastLocLon)
    }
    dbService.projectsByLocationPaged(
      minLocLat, maxLocLat, minLocLon, maxLocLon,
      req.query.afterId, req.query.beforeId, req.query.claimContents
    )
      .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, results, []))
      .then(results => { res.json(results).end() })
      .catch(err => { console.error(err); res.status(500).json(""+err).end() })
  }

  getCanClaim(req, res) {
    dbService.registrationByDid(res.locals.authTokenIssuer)
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
        .then(results => hideDidsAndAddLinksToNetworkInDataKey(res.locals.authTokenIssuer, { data: results }, []))
        .then(resultData => { res.json(resultData).end() })
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
 * @typedef GiveSummary
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} agentDid
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
 * @see also /providersToGive
 */

/**
 * @typedef GiveSummaryArrayMaybeMoreBody
 * @property {array.GiveSummary} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef JwtSummary
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
 * @typedef JwtSummaryArrayMaybeMoreBody
 * @property {array.JwtSummary} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

// similar code is in partner-router.js
/**
 * @typedef LocationCount
 * @property {number} minTileLat - minimum latitude of this bucket
 * @property {number} minTileLon - minimum longitude of this bucket
 * @property {number} minFoundLat - lowest latitude of matches found in this bucket
 * @property {number} minFoundLon - westernmost longitude of matches found in this bucket
 * @property {number} maxFoundLat - highest latitude of matches found in this bucket
 * @property {number} maxFoundLon - easternmost longitude of matches found in this bucket
 * @property {number} recordCount - number of records found in this bucket
 */

// similar code is in partner-router.js
/**
 * @typedef GridCounts
 * @property {array.LocationCount} tiles - counts of records in each tile of the grid
 * @property {number} minGridLat - minimum latitude of the searched area (which may be outside the bounding box)
 * @property {number} minGridLon - minimum longitude of the searched area (which may be outside the bounding box)
 * @property {number} tileWidth - width of each tile
 * @property {number} numTilesWide - number of tiles wide for the searched area
 */

/**
 * @typedef OfferSummary
 * @property {string} jwtId
 * @property {string} handleId
 * @property {datetime} issuedAt
 * @property {string} offeredByDid
 * @property {string} recipientDid - recipient DID if this is for a plan
 * @property {string} recipientPlanId - plan handle ID if this is for a plan
 * @property {string} unit
 * @property {number} amount
 * @property {number} amountGiven - total of GiveSummary amounts to this OfferSummary
 * @property {number} amountGivenConfirmed - total of GiveSummary amounts confirmed by recipient
 * @property {string} objectDescription
 * @property {datetime} validThrough
 * @property {object} fullClaim
 */

/**
 * @typedef OfferSummaryArrayMaybeMoreBody
 * @property {array.OfferSummary} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef PlanSummary
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
 * @typedef PlanSummaryArrayMaybeMore
 * @property {array.PlanSummary} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef PlanSummaryWithFulfilledLinkConfirmation
 * @property {PlanSummary} data
 * @property {boolean} childFullfillsLinkConfirmed true when the link between plans has been confirmed by both
 */

/**
 * @typedef PlanSummaryAndPreviousClaim
 * @property {PlanSummary} plan the current plan details
 * @property {object} wrappedClaimBefore the JWT claim that is the most recent before the "after" limit on the query
 */

/**
 * @typedef PlanSummaryAndPreviousClaimArrayMaybeMore
 * @property {array.PlanSummaryAndPreviousClaim} data (as many as allowed by our limit)
 * @property {boolean} hitLimit true when the results may have been restricted due to throttling the result size -- so there may be more after the last and, to get complete results, the client should make another request with its ID as the beforeId/afterId
 */

/**
 * @typedef ProviderLink
 * @Property {string} providerId identifier DID or handleId
 * @Property {boolean} linkConfirmed true if the link has been confirmed
 */

/**
 * Get all claims for the query inputs, paginated, reverse-chronologically
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/claims
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, and can also include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {JwtSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of JwtSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claims', dbController.getAllJwtsPaged)

/**
 * Get all claims where this user is issuer and the claimType is from `claimTypes` arg (array of string)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/claimsForIssuerWithTypes
 * @param {string} claimTypes.query.required - the array of `claimType` strings to find
 * @param {string} afterId.query.optional - the ID of the JWT entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the ID of the JWT entry before which to look (exclusive); by default, the last one is included, and can also include the last one with an explicit value of '7ZZZZZZZZZZZZZZZZZZZZZZZZZ'
 * @returns {JwtSummaryArrayMaybeMoreBody} 200 - 'data' property with array of JwtSummary claims issued by this user with any of those claim types, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/claimsForIssuerWithTypes', dbController.getAllIssuerClaimTypesPaged)

/**
 * Check if current user can create a claim.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/canClaim
 * @returns {object} 200 - 'data' boolean property tells whether this user is allowed to create a claim
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canClaim', dbController.getCanClaim)

/**
 * Retrieve all confirmers for a set of claims. (Same as POST version. Similar to Elasticsearch approach with parameter in the body.)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/confirmers
 * @param {array} claimEntryIds.body.required the claim JWT IDs, for whose confirmers I want to find
 * @returns {object} 200 - 'data' array of IDs who have confirmed given claims
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/confirmers', serviceController.getConfirmerIds)

/**
 * Retrieve all confirmers for a set of claims. (Same as GET version. Similar to Elasticsearch approach for a large number of inputs.)
 *
 * @group reports - Reports (with paging)
 * @route POST /api/v2/report/confirmers
 * @param {array} claimEntryIds.body.required the claim JWT IDs, for whose confirmers I want to find
 * @returns {object} 200 - 'data' array of IDs who have confirmed given claims
 * ... and, yes, a 200 is weird for a POST, but this is just for convenience and a GET is recommended anyway
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/confirmers', serviceController.getConfirmerIds)

/**
 * Get totals of all the gift-only gives (like /giveTotals but only for those that are gifts)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giftedTotals
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planId.query.optional - handle ID of the plan which has received gives
 * @param {string} recipientId.query.optional - DID of recipient who has received gives
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {object} 200 - 'data' property with keys being units and values being: amount & amountConfirmed
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get('/giftedTotals', dbController.getGiftedTotals)

/**
 * Search gives
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/gives
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} agentDid.query.optional - issuing agent
 * @param {string} handleId.query.optional - persistent handleId
 * @param {string} recipientId.query.optional - recipient
 * @param {string} fulfillsHandleId.query.optional - for ones that fulfill a particular item (eg. an offer)
 * @param {string} fulfillsType.query.optional - for ones that fulfill a particular type
 * @returns {GiveSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of GiveSummary entries, reverse chronologically;
 *  'hitLimit' boolean property if there may be more;
 *  but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - client client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/gives', dbController.getGivesPaged)

/**
 * Get gives dedicated to any in a list of plan IDs
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givesToPlans
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - JSON.stringified array with handle IDs of the plans which have received gives
 * @returns {GiveSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of GiveSummary entries, reverse chronologically;
 *   'hitLimit' boolean property if there may be more;
 *   but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/givesToPlans', dbController.getGivesToPlansPaged)
  // For new deployments and for endorser.ch after all users have updated their client apps: remove this endpoint.
  .get('/givesForPlans', dbController.getGivesToPlansPaged)

/**
 * Get give fulfilled by this give
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveFulfilledByGive
 * @param {string} giveHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @returns {GiveSummaryWithFulfilledLinkConfirmation} 200 - 'data' property with PlanSummary entry and flag indicating whether the fulfill relationship is confirmed
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
// (not yet implemented)
//  .get('/giveFulfilledByGive', dbController.getGiveFulfilledBy)

/**
 * Get GiveSummary fulfillers for a particular GiveSummary
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveFulfillersToGive
 * @param {string} handleId.query.required - the handleId of the give entry
 * @returns {GiveSummaryArrayMaybeMoreBody} 200 - 'data' property with each of the fulfillers, reverse chronologically;
 * 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveFulfillersToGive', dbController.getGiveFulfillersToGive)

/**
 * Get GiveSummary fulfillers for a particular OfferSummary
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givefulfillersToOffer
 * @param {string} handleId.query.required - the handleId of the give entry
 * @returns {GiveSummaryArrayMaybeMoreBody} 200 - 'data' property with each of the fulfillers, reverse chronologically;
 * 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveFulfillersToOffer', dbController.getGiveFulfillersToOffer)

/**
 * Get gives provided by this provider
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/givesProvidedBy
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} providerId.query.optional - handle ID of the provider which may have helped with gives
 * @returns {GiveSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of GiveSummary entries, reverse chronologically;
 * 'hitLimit' boolean property if there may be more;
 * but note that the `providers` property of each entry is not populated
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/givesProvidedBy', dbController.getGivesProvidedBy)

/**
 * Get totals of gives (like /giftedTotals but potentially with trades as well)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/giveTotals
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} onlyGifted.query.optional - only the ones that fulfill DonateAction (and not any TradeAction)
 * @param {string} onlyTraded.query.optional - only the ones that fulfill TradeAction
 * @param {string} planHandleId.query.optional - handle ID of the plan which has received gives
 * @param {string} planId.query.optional - handle ID of the plan which has received gives
 * @param {string} recipientId.query.optional - DID of recipient who has received gives
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {object} 200 - 'data' property with keys being units and values being: amount & amountConfirmed
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/giveTotals', dbController.getGiveTotals)

/**
 * Search offers
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offers
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} handleId.query.optional - persistent ID of offer
 * @param {string} offeredByDid.query.optional - originator of offer
 * @param {string} recipientPlanId.query.optional - plan which is recipient of offer
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @param {string} validThrough.query.optional - date up to which offers are valid
 * @returns {OfferSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of OfferSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offers', dbController.getOffersPaged)

/**
 * Get offers dedicated to any in a list of plan IDs
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offersToPlans
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planIds.query.optional - handle ID of the plan which has received offers
 * @returns {OfferSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of OfferSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offersToPlans', dbController.getOffersForPlansPaged)

/**
 * Get offers dedicated to any project owned by the requestor (as issuer or agent)
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offersToPlansOwnedByMe
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @returns {OfferSummaryArrayMaybeMoreBody} 200 - 'data' property with matching array of OfferSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.get('/offersToPlansOwnedByMe', dbController.getOffersForPlanOwnerPaged)

/**
 * Get totals of offers
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/offerTotals
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} planId.query.optional - handle ID of the plan which has received offers
 * @param {string} recipientId.query.optional - DID of recipient who has received offers
 * @param {string} unit.query.optional - unit code to restrict amounts
 * @returns {object} 200 - 'data' property with keys being units and values being the number amounts of total offers for them
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/offerTotals', dbController.getOfferTotals)

/**
 * Cut the bbox into sections, then return an array location + plan-counts for how many are located in that section with that location
 * Currently, this cuts the bbox into sections, anywhere from 4-8 tiles on side.
 *
 * Note that the partner API has a similar endpoint /api/partner/userProfileCountsByBBox
 * The front-end is simpler if the parameters and results are similar.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/planCountsByBBox
 * @param {string} minLocLat.query.required - minimum latitude in degrees of bounding box being searched
 * @param {string} maxLocLat.query.required - maximum latitude in degrees of bounding box being searched
 * @param {string} minLocLon.query.required - minimum longitude in degrees of bounding box being searched
 * @param {string} maxLocLon.query.required - maximum longitude in degrees of bounding box being searched
 * @returns {array.GridCounts} 200 - 'data' property with 'tiles' property with matching array of entries, each with a count of plans in that tile
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/planCountsByBBox', dbController.getPlanCountsByBBox)

  /**
 * Get plan fulfilled by given plan
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/planFulfilledByPlan
 * @param {string} planHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @returns {PlanSummaryWithFulfilledLinkConfirmation} 200 - 'data' property with PlanSummary entry and flag indicating whether the fulfill relationship is confirmed
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/planFulfilledByPlan', dbController.getPlanFulfilledBy)

/**
 * Get plans that fulfill given plan
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/fulfillersToPlan
 * @param {string} planHandleId.query.required - the handleId of the plan which is fulfilled by this plan
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is not included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanSummaryArrayMaybeMore} 200 - 'data' property with matching array of PlanSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/planFulfillersToPlan', dbController.getPlanFulfillersToPlan)

/**
 * Get all plans for the query inputs, paginated, reverse-chronologically
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plans
 * @param {string} planHandleIds.query.optional - JSON array of plan handle IDs to retrieve specific plans (when provided, other query parameters are ignored and a resultWarning is included)
 * @param {string} afterId.query.optional - the JWT ID of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @param {string} jwtId.query.optional
 * @param {string} issuerDid.query.optional
 * @param {string} agentDid.query.optional
 * @param {string} handleId.query.optional
 * @param {string} description.query.optional
 * @param {string} endTime.query.optional
 * @param {string} startTime.query.optional
 * @param {string} resultIdentifier.query.optional
 * @returns {PlanSummaryArrayMaybeMore} 200 - 'data' property with matching array of PlanSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more; 'resultWarning' string if planHandleIds was used with other parameters
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plans', dbController.getAllPlansPaged)


/**
 * Get all plans by the issuer, paginated, reverse-chronologically
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plansByIssuer
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanSummaryArrayMaybeMore} 200 - 'data' property with matching array of PlanSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByIssuer', dbController.getPlansByIssuerPaged)

/**
 * Get all plans that have a location in the bbox specified, paginated, reverse-chronologically
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plansByBBox
 * @param {string} minLocLat.query.required - minimum latitude in degrees of bounding box being searched
 * @param {string} maxLocLat.query.required - maximum latitude in degrees of bounding box being searched
 * @param {string} minLocLon.query.required - minimum longitude in degrees of bounding box being searched
 * @param {string} maxLocLon.query.required - maximum longitude in degrees of bounding box being searched
 * @param {string} afterId.query.optional - the rowId of the entry after which to look (exclusive); by default, the first one is included, and can also include the first one with an explicit value of '0'
 * @param {string} beforeId.query.optional - the rowId of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanSummaryArrayMaybeMore} 200 - 'data' property with matching array of PlanSummary entries, reverse chronologically; 'hitLimit' boolean property if there may be more
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByBBox', dbController.getPlansByLocationAndContentsPaged)

/**
 * @deprecated
 * @see /api/v2/report/plansByBBox
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/plansByLocation', dbController.getPlansByLocationAndContentsPaged)

/**
 * Get providers for a particular give
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 *  @group reports - Reports (with paging)
 * @route GET /api/v2/report/providersToGive
 * @param {string} giveHandleId.query.optional - the jwtId of the give entry
 * @returns {array.ProviderLink} 200 - 'data' property with each of the providers with known types
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/providersToGive', dbController.getGiveProviders)

/**
 * Retrieve plans that have their latest version before/after given claim IDs (GET version)
 * For smaller lists of plan IDs, use query parameters
 *
 * @group reports - Reports (with paging)
 * @route GET /api/v2/report/plansLastUpdateBetween
 * @param {string[]} planIds.query.required - JSON stringified array of plan handle IDs
 * @param {string} afterId.query.required - the JWT ID of the entry after which to look (exclusive)
 * @param {string} beforeId.query.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanSummaryAndPreviousClaimArrayMaybeMore} Object with data array and hitLimit boolean
 */
 .get('/plansLastUpdatedBetween', dbController.getPlansLastUpdatedBetweenFromGet)

/**
 * Retrieve plans that have their latest version before/after given claim IDs (POST version)
 * For larger lists of plan IDs, use POST with JSON body
 *
 * @group reports - Reports (with paging)
 * @route POST /api/v2/report/plansLastUpdatedBetween
 * @param {string[]} body.planIds.required - Array of plan handle IDs
 * @param {string} body.afterId.required - the JWT ID of the entry after which to look (exclusive)
 * @param {string} body.beforeId.optional - the JWT ID of the entry before which to look (exclusive); by default, the last one is included
 * @returns {PlanSummaryAndPreviousClaimArrayMaybeMore} Object with data array and hitLimit boolean
 */
 .post('/plansLastUpdatedBetween', dbController.getPlansLastUpdatedBetweenFromPost)
