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
import { AUTHORIZATION_HEADER, BEARER_PREFIX } from '../services/util'

import ClaimService from '../services/claim.service';

class ClaimController {
  getIssuersMatchingClaim(req, res) {
    ClaimService.thisClaimAndConfirmationsIssuersMatchingClaimId(req.query.claimId)
      .then(result =>
            hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, { result : result}, []))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end() })
  }
  getRateLimits(req, res) {
    ClaimService.getRateLimits(res.locals.authTokenIssuer)
      .then(r => res.json(r))
      .catch(err => {
        if (err.clientError) {
          res.status(400).json({ error: err.clientError }).end()
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
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
}
let actionController = new ActionController();


import TenureService from '../services/tenure.service';
class TenureController {
  getAtPoint(req, res) {
    TenureService.atPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
  getClaimsAndConfirmationsAtPoint(req, res) {
    TenureService.getClaimsAndConfirmationsAtPoint(req.query.lat, req.query.lon)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
}
let tenureController = new TenureController();


import OrgRoleService from '../services/org.service';
class OrgRoleController {
  getClaimsAndConfirmationsOnDate(req, res) {
    OrgRoleService.getClaimsAndConfirmationsOnDate(req.query.orgName, req.query.roleName, req.query.onDate)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.authTokenIssuer, result, []))
      .then(r => res.json(r))
      .catch(err => res.status(500).json(""+err).end())
  }
}
let orgRoleController = new OrgRoleController();


import { dbService } from '../services/endorser.db.service';
class DbController {
  getVoteCounts(req, res) {
    dbService.retrieveVoteCounts()
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getSeenByAll(req, res) {
    dbService.getSeenByAll()
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  /**
   * @deprecated use the claim version
   */
  makeMeVisibleTo(req, res) {
    if (!req.headers[AUTHORIZATION_HEADER]
        || !req.headers[AUTHORIZATION_HEADER].startsWith(BEARER_PREFIX)) {
      res.status(401).json({ success: false, message: 'Missing Authorization header' }).end()
      return
    }
    const authJwt = req.headers[AUTHORIZATION_HEADER].substring(BEARER_PREFIX.length);
    addCanSee(req.body.did, res.locals.authTokenIssuer, null, authJwt)
      .then((result) => res.status(200).json({success:result}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  /**
   * @deprecated use the claim version
   */
  makeMeInvisibleTo(req, res) {
    if (!req.headers[AUTHORIZATION_HEADER]
        || !req.headers[AUTHORIZATION_HEADER].startsWith(BEARER_PREFIX)) {
      res.status(401).json({ success: false, message: 'Missing Authorization header' }).end()
      return
    }
    const authJwt = req.headers[AUTHORIZATION_HEADER].substring(BEARER_PREFIX.length);
    removeCanSee(req.body.did, res.locals.authTokenIssuer, null, authJwt)
      .then((result) => res.status(200).json({success:result}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  /**
   * @deprecated use the claim version
   */
  makeMeGloballyVisible(req, res) {
    if (!req.headers[AUTHORIZATION_HEADER]
        || !req.headers[AUTHORIZATION_HEADER].startsWith(BEARER_PREFIX)) {
      res.status(401).json({ success: false, message: 'Missing Authorization header' }).end()
      return
    }
    const authJwt = req.headers[AUTHORIZATION_HEADER].substring(BEARER_PREFIX.length);
    makeGloballyVisible(res.locals.authTokenIssuer, req.body.url, authJwt)
      .then((result) => res.status(200).json({success:result}).end())
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getCanSeeDids(req, res) {
    getAllDidsRequesterCanSee(res.locals.authTokenIssuer)
      .then(r => res.json(r))
      .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  }
  getCanSeeMeExplicitly(req, res) {
    canSeeExplicitly(req.query.did, res.locals.authTokenIssuer)
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
 * @deprecated use the claim v1 version
 * @group claims for visibility
 */
  .post('/canSeeMe', dbController.makeMeVisibleTo)

/**
 * @deprecated use the claim v1 version
 * @group claims for visibility
 */
  .post('/cannotSeeMe', dbController.makeMeInvisibleTo)

/**
 * @deprecated use the claim v1 version
 * @group claims for visibility
 */
  .post('/makeMeGloballyVisible', dbController.makeMeGloballyVisible)

/**
 * Get all DIDs this person can see
 *
 * @group reports on DID network
 * @route GET /api/report/whichDidsICanSee
 * @returns {array.object} 200 - list of DIDs user can see
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/whichDidsICanSee', dbController.getCanSeeDids)

/**
 * True if DID can explicitly see requestor.
 * Does not check visibility in general, eg. requestor may be globally visible but not explicitly visible.
 *
 * @group reports on DID network
 * @route GET /api/report/canDidExplicitlySeeMe
 * @param {string} did.query.required
 * @returns boolean 200 - true if the DID can see the caller
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/canDidExplicitlySeeMe', dbController.getCanSeeMeExplicitly)

/**
 * Retrieve all globally-visible DIDs
 *
 * @group reports on DID network
 * @route GET /api/report/globallyVisibleDids
 * @returns {array.string} 200 - list of DIDs that are globally visible
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/globallyVisibleDids', dbController.getSeenByAll)

/**
 * Get issuers for a claim
 * @deprecated Use /api/v2/report/confirmers instead for pagination someday.
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/issuersWhoClaimedOrConfirmed
 * @param {string} claimId.query.required - the ID of the claim
 * @returns {array.String} 200 - issuers who have claimed or confirmed same claim
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/issuersWhoClaimedOrConfirmed', claimController.getIssuersMatchingClaim)

/**
 * Get claims and confirmations for individual
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/actionClaimsAndConfirmationsSince
 * @param {datetime} date.query.optional - the date from which to show actionclaims
 * @returns {array.ActionClaimsConfirmations} 200 - action claims with the confirmations that go along
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/actionClaimsAndConfirmationsSince', actionController.getActionClaimsAndConfirmationsSince)

/**
 * Get tenure claims for a point
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/tenureClaimsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/tenureClaimsAtPoint', tenureController.getAtPoint)

/**
 * Get tenure claims and confirmations for a point
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/tenureClaimsAndConfirmationsAtPoint
 * @param {number} lat.query.required
 * @param {number} lon.query.required
 * @returns {array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/tenureClaimsAndConfirmationsAtPoint', tenureController.getClaimsAndConfirmationsAtPoint)

/**
 * Get org-role claims and confirmations for org & role & date
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/orgRoleClaimsAndConfirmationsOnDate
 * @param {string} orgName.query.required
 * @param {string} roleName.query.required
 * @param {date} onDate.query.required
 * @returns {array.object} 200 - claimed tenures (up to 50)
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/orgRoleClaimsAndConfirmationsOnDate', orgRoleController.getClaimsAndConfirmationsOnDate)

/**
 * Get all votes for all candidates.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/voteCounts
 * @returns {array.object} 200 - { speaker, title, count }
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
//  .get('/voteCounts', dbController.getVoteCounts)

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
 * Get this DID's registration and claim limits.
 *
 * @group reports v1 - (with limited result counts)
 * @route GET /api/report/rateLimits
 * @returns {RateLimits} 200 - the count & limits of claims & registrations
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/rateLimits', claimController.getRateLimits)
