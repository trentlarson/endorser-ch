/**
 *
 * See report-all-router.js instead.
 * Many of these are deprecated: they often have a limit on the number of DB records.
 * The recommended versions return a payload with a "result" field, and potentially other fields like "error".
 *
 */

import * as express from 'express'
import { hideDidsAndAddLinksToNetwork, makeGloballyVisible } from '../services/util-higher'
import { addCanSee, canSeeExplicitly, getAllDidsRequesterCanSee, removeCanSee } from '../services/network-cache.service'

import ClaimService from '../services/claim.service';
class ClaimController {
  getIssuersMatchingClaim(req, res) {
    ClaimService.thisClaimAndConfirmationsIssuersMatchingClaimId(req.query.claimId)
      .then(result =>
            hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, { result : result}))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end() })
  }
  getRateLimits(req, res) {
    ClaimService.getRateLimits(res.locals.tokenIssuer)
      .then(r => res.json(r))
      .catch(err => {
        if (err.clientError) {
          res.status(400).json({ error: { message: err.clientError.message, code: err.clientError.code } })
        } else {
          console.log(err)
          res.status(500).json(""+err).end()
        }
      })
  }
}
let claimController = new ClaimController();


import ActionService from '../services/action.service';
class ActionController {
  getActionClaimsAndConfirmationsSince(req, res) {
    ActionService.getActionClaimsAndConfirmationsForEventsSince(req.query.dateTime)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
}
let actionController = new ActionController();


import TenureService from '../services/tenure.service';
class TenureController {
  getAtPoint(req, res) {
    TenureService.atPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
  getClaimsAndConfirmationsAtPoint(req, res) {
    TenureService.getClaimsAndConfirmationsAtPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
}
let tenureController = new TenureController();


import OrgRoleService from '../services/org.service';
class OrgRoleController {
  getClaimsAndConfirmationsOnDate(req, res) {
    OrgRoleService.getClaimsAndConfirmationsOnDate(req.query.orgName, req.query.roleName, req.query.onDate)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
}
let orgRoleController = new OrgRoleController();


import { dbService } from '../services/endorser.db.service';
class DbController {
  getVoteCounts(req, res) {
    dbService.retrieveVoteCounts()
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getSeenByAll(req, res) {
    dbService.getSeenByAll()
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  makeMeVisibleTo(req, res) {
    addCanSee(req.body.did, res.locals.tokenIssuer)
      .then(() => res.status(200).json({success:true}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  makeMeInvisibleTo(req, res) {
    removeCanSee(req.body.did, res.locals.tokenIssuer)
      .then(() => res.status(200).json({success:true}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  makeMeGloballyVisible(req, res) {
    makeGloballyVisible(res.locals.tokenIssuer, req.body.url)
      .then(() => res.status(200).json({success:true}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getCanSeeDids(req, res) {
    getAllDidsRequesterCanSee(res.locals.tokenIssuer)
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getCanSeeMeExplicitly(req, res) {
    canSeeExplicitly(req.query.did, res.locals.tokenIssuer)
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
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
 * @typedef DidBody
 * @property {string} did.required
 */

/**
 * @typedef UrlBody
 * @property {string} url
 */

/**
 * Consent to make push-token issuer's ID visible to the given ID
 *
 * @group reports on network - Visibility
 * @route POST /api/report/canSeeMe
 * @param {DidBody.model} body.body.required
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/canSeeMe', dbController.makeMeVisibleTo)

/**
 * Make push-token issuer's ID invisible to the given ID
 *
 * @group reports on network - Visibility
 * @route POST /api/report/cannotSeeMe
 * @param {DidBody.model} body.body.required
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/cannotSeeMe', dbController.makeMeInvisibleTo)

/**
 * Consent to make push-token issuer's ID visible to the world
 *
 * @group reports on network - Visibility
 * @route POST /api/report/makeMeGloballyVisible
 * @param {UrlBody.model} body.body.optional
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/makeMeGloballyVisible', dbController.makeMeGloballyVisible)

/**
 * Get all DIDs this person can see
 *
 * @group reports on network - Visibility
 * @route GET /api/report/whichDidsICanSee
 * @returns {Array.object} 200 - list of DIDs user can see
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/whichDidsICanSee', dbController.getCanSeeDids)

/**
 * Get all DIDs that can explicitly see this person.
 * Only includes explicit ones because we don't show everyone to those allowing '*' to see them.
 *
 * @group reports on network - Visibility
 * @route GET /api/report/whichDidsCanSeeMe
 * @param {string} did.query.required
 * @returns boolean 200 - true if the DID can see the caller
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canDidExplicitlySeeMe', dbController.getCanSeeMeExplicitly)

/**
 * @typedef RateLimits
 * @property {string} doneClaimsThisWeek
 * @property {string} doneRegistrationsThisMonth
 * @property {string} maxClaimsPerWeek
 * @property {string} maxRegistrationsPerMonth
 * @property {string} nextMonthBeginDateTime
 * @property {string} nextWeekBeginDateTime
 */

/**
 * Get issuers for a claim
 *
 * @group reports v1 - Reports (with limited result counts)
 * @route GET /api/report/issuersWhoClaimedOrConfirmed
 * @param {string} claimId.query.required - the ID of the claim
 * @returns {Array.String} 200 - issuers who have claimed or confirmed same claim
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/issuersWhoClaimedOrConfirmed', claimController.getIssuersMatchingClaim)

/**
 * Get claims and confirmations for individual
 *
 * @group reports v1 - Reports
 * @route GET /api/report/actionClaimsAndConfirmationsSince
 * @param {datetime} date.query.optional - the date from which to show actionclaims
 * @returns {Array.ActionClaimsConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/actionClaimsAndConfirmationsSince', actionController.getActionClaimsAndConfirmationsSince)

/**
 * Get tenure claims for a point
 *
 * @group reports v1 - Reports
 * @route GET /api/report/tenureClaimsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/tenureClaimsAtPoint', tenureController.getAtPoint)

/**
 * Get tenure claims and confirmations for a point
 *
 * @group reports v1 - Reports
 * @route GET /api/report/tenureClaimsAndConfirmationsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/tenureClaimsAndConfirmationsAtPoint', tenureController.getClaimsAndConfirmationsAtPoint)

/**
 * Get org-role claims and confirmations for org & role & date
 *
 * @group reports v1 - Reports
 * @route GET /api/report/orgRoleClaimsAndConfirmationsOnDate
 * @param {string} orgName.query.required
 * @param {string} roleName.query.required
 * @param {date} onDate.query.required
 * @returns {Array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/orgRoleClaimsAndConfirmationsOnDate', orgRoleController.getClaimsAndConfirmationsOnDate)

/**
 * Get all votes for all candidates.
 *
 * @group reports v1 - Reports
 * @route GET /api/report/voteCounts
 * @returns {Array.object} 200 - { speaker, title, count }
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
//  .get('/voteCounts', dbController.getVoteCounts)

/**
 * Retrieve all globally-visible DIDs
 *
 * @group reports v1 - Reports
 * @route GET /api/report/globallyVisibleDids
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/globallyVisibleDids', dbController.getSeenByAll)

/**
 * Get this DID's registration and claim limits.
 *
 * @group reports v1 - Reports
 * @route GET /api/report/rateLimits
 * @returns {RateLimits} 200 - the count & limits of claims & registrations
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/rateLimits', claimController.getRateLimits)
