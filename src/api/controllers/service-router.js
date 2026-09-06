/**
 * Endpoints for other services, not for end users.
 *
 * Every route here requires the calling service to authenticate as itself with a
 * DID on the MEMBERSHIP_SERVICE_DIDS allowlist. Callers name the subject as a
 * parameter; they never forward a user's credential.
 */

import * as express from 'express'

import { membershipResponse } from '../services/membership.service'

class ServiceController {
  async getMembership(req, res) {
    try {
      const { status, body } =
        await membershipResponse(res.locals.authTokenIssuer, req.params.did)
      res.status(status).json(body).end()
    } catch (err) {
      // A failure here means "cannot determine", which callers must not read as
      // "not a member". Keep the body free of internals.
      console.error('Error answering membership for', req.params.did, err)
      res.status(500).json({
        error: { message: 'Could not determine membership.', code: 'MEMBERSHIP_UNAVAILABLE' }
      }).end()
    }
  }
}
const serviceController = new ServiceController()

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Content-Type', 'application/json')
    next()
  })

/**
 * @typedef Membership
 * @property {string} did - the subject DID, echoed back
 * @property {boolean} member - true only if registered and not revoked
 * @property {string} reason - NOT_REGISTERED or REVOKED, present when member is false
 * @property {number} maxClaimsPerWeek - present when member is true
 * @property {number} maxRegistrationsPerMonth - present when member is true
 * @property {number} registeredEpoch - present when member is true
 * @property {number} cacheSeconds - how long this answer may be cached
 */

/**
 * Ask whether a DID is a member in good standing.
 *
 * The caller authenticates as itself and must be on the service allowlist. A 200
 * carries the answer in the "member" field; both true and false are answers.
 * Any non-200 means this service could not determine membership, and callers
 * must fail closed rather than treat it as either answer.
 *
 * @group services - Service-to-service
 * @route GET /api/service/membership/{did}
 * @param {string} did.path.required - the subject DID to ask about
 * @returns {Membership} 200 - the membership answer
 * @returns {Error} 400 - the subject DID is missing or malformed
 * @returns {Error} 401 - the caller sent no Authorization Bearer JWT
 * @returns {Error} 403 - the caller is not on the service allowlist
 * @returns {Error} 500 - membership could not be determined
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/membership/:did', (req, res) => serviceController.getMembership(req, res))
