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
  async postMembership(req, res) {
    try {
      const { status, body } =
        await membershipResponse(res.locals.authTokenIssuer, req.body.subjectToken)
      res.status(status).json(body).end()
    } catch (err) {
      // A failure here means "cannot determine", which callers must not read as
      // "not a member". Keep the body free of internals, and never log the token.
      console.error('Error answering membership asked by', res.locals.authTokenIssuer, err)
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
 * @property {string} did - the subject DID, taken from the subjectToken's issuer
 * @property {boolean} member - true only if registered and not revoked
 * @property {string} reason - NOT_REGISTERED or REVOKED, present when member is false
 * @property {number} maxClaimsPerWeek - present when member is true
 * @property {number} maxRegistrationsPerMonth - present when member is true
 * @property {number} registeredEpoch - present when member is true
 * @property {number} cacheSeconds - how long this answer may be cached
 */

/**
 * @typedef MembershipRequest
 * @property {string} subjectToken.required - the user's own credential to the calling
 *   service, which must name that service's DID in "aud" and carry a short "exp"
 */

/**
 * Ask whether the user who authorized you is a member in good standing.
 *
 * The calling service authenticates as itself and must be on the service
 * allowlist. The subject is not named directly: it is the issuer of the
 * subjectToken, which is the user's own credential to the calling service. Since
 * that token names the service in "aud", it proves the user authorized this
 * service to ask, and it cannot be replayed here as a credential.
 *
 * A 200 carries the answer in the "member" field; both true and false are
 * answers. Any non-200 means this service could not determine membership, and
 * callers must fail closed rather than treat it as either answer.
 *
 * @group services - Service-to-service
 * @route POST /api/service/membership
 * @param {MembershipRequest.model} .body.required - the user's subjectToken
 * @returns {Membership} 200 - the membership answer
 * @returns {Error} 400 - the subjectToken is missing, malformed, unexpiring, or too long-lived
 * @returns {Error} 401 - the caller sent no Authorization Bearer JWT
 * @returns {Error} 403 - the caller is not allowlisted, or the subjectToken does not name it
 * @returns {Error} 500 - membership could not be determined
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/membership', (req, res) => serviceController.postMembership(req, res))
