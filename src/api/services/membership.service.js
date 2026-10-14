/**
 * Membership introspection for other services.
 *
 * A signature proves who signed; it does not prove membership. Only this service
 * knows who is registered, so other services ask here. They ask with their own
 * credential and name the subject DID as a parameter, rather than forwarding the
 * subject's credential: a forwarded credential acts as its issuer everywhere,
 * which makes every calling service able to impersonate its own users.
 *
 * See SECURITY-PLAN-4-jwt-replay-and-credential-separation.md
 */

import l from '../../common/logger'
import { dbService } from './endorser.db.service'
import { isDid } from './util'
import { decodeAndVerifyJwt } from './vc'

// Kept in sync with claim.service.js, which enforces the same limits.
const DEFAULT_MAX_REGISTRATIONS_PER_MONTH =
      process.env.DEFAULT_MAX_REGISTRATIONS_PER_MONTH || 31
const DEFAULT_MAX_CLAIMS_PER_WEEK =
      process.env.DEFAULT_MAX_CLAIMS_PER_WEEK || 140

// How long a caller may cache an answer. Revocation takes effect within this
// window, so it is the knob that trades staleness against load.
const MEMBERSHIP_CACHE_SECONDS =
      parseInt(process.env.MEMBERSHIP_CACHE_SECONDS || '60', 10)

// DIDs of services permitted to ask about other DIDs. Comma-separated.
// Without this list the endpoint is a membership oracle for anyone.
const ALLOWED_SERVICE_DIDS =
      (process.env.MEMBERSHIP_SERVICE_DIDS || '')
        .split(',')
        .map(did => did.trim())
        .filter(did => did.length > 0)

// A subject token is the user's own credential to the calling service, reused as
// evidence that the user authorized this service. It must expire, and soon: it is
// a grant to ask, and the service can re-ask until it lapses. Step 4.3's
// auth_token_seen table is what will make it single-use.
const SUBJECT_TOKEN_MAX_SECONDS =
      parseInt(process.env.MEMBERSHIP_SUBJECT_TOKEN_MAX_SECONDS || '300', 10)

export const MEMBERSHIP_REASONS = {
  NOT_REGISTERED: 'NOT_REGISTERED',
  REVOKED: 'REVOKED',
}

export function isAllowedServiceDid(did) {
  return !!did && ALLOWED_SERVICE_DIDS.includes(did)
}

export function allowedServiceCount() {
  return ALLOWED_SERVICE_DIDS.length
}

/**
 * Answer whether a DID is a member in good standing.
 *
 * Resolves for both answers. A rejection means this service could not determine
 * the answer, which is a different thing from "not a member" and callers must
 * treat it differently.
 *
 * @param subjectDid the DID being asked about
 * @returns {Promise<object>} { member, reason?, maxClaimsPerWeek?, maxRegistrationsPerMonth?, registeredEpoch? }
 */
export async function membershipForDid(subjectDid) {
  const registered = await dbService.registrationByDid(subjectDid)

  if (!registered) {
    return { member: false, reason: MEMBERSHIP_REASONS.NOT_REGISTERED }
  }

  // '??' and not '||': zero is a meaningful allowance and must survive.
  // claim.service.js:1862 already enforces a zero allowance; reporting it as the
  // default is what let a disabled user keep passing membership checks.
  const maxClaimsPerWeek = registered.maxClaims ?? DEFAULT_MAX_CLAIMS_PER_WEEK
  const maxRegistrationsPerMonth = registered.maxRegs ?? DEFAULT_MAX_REGISTRATIONS_PER_MONTH

  // 'disabled' is the explicit revocation flag; it takes effect once the column
  // exists and registrationByDid selects it. Until then a zero claim allowance is
  // the revocation lever, and it works today because enforcement already honors it.
  if (registered.disabled || Number(maxClaimsPerWeek) === 0) {
    return { member: false, reason: MEMBERSHIP_REASONS.REVOKED }
  }

  return {
    member: true,
    maxClaimsPerWeek: Number(maxClaimsPerWeek),
    maxRegistrationsPerMonth: Number(maxRegistrationsPerMonth),
    registeredEpoch: registered.epoch,
  }
}

/**
 * Verify a subject token and return the DID it authorizes asking about.
 *
 * The token is signed by the user and audienced to the calling service, so it
 * proves the user authorized this service. It names no audience for this server,
 * which is what keeps it from working here as a credential.
 *
 * @returns { subjectDid } or { error } with a clientError-shaped object
 */
export async function subjectFromToken(callerDid, subjectToken) {
  if (!subjectToken) {
    return { error: { message: 'Supply the user\'s subjectToken.', code: 'SUBJECT_TOKEN_MISSING' } }
  }

  let payload
  try {
    // Verified without an audience check: this token's "aud" names the calling
    // service, not this server, and is checked against the caller below.
    const result = await decodeAndVerifyJwt(subjectToken)
    if (!result.verified) {
      return { error: { message: 'The subjectToken failed verification.', code: 'SUBJECT_TOKEN_INVALID' } }
    }
    payload = result.payload
  } catch (e) {
    const inner = e.clientError ? e.clientError.message : 'signature or format was rejected'
    return { error: { message: `The subjectToken failed verification: ${inner}`, code: 'SUBJECT_TOKEN_INVALID' } }
  }

  // The consent is to this caller specifically, so a token given to one service
  // cannot be used by another.
  const audArray = payload.aud ? (Array.isArray(payload.aud) ? payload.aud : [payload.aud]) : []
  if (!audArray.includes(callerDid)) {
    return {
      error: {
        message: 'The subjectToken does not name this service in "aud", so the user did not authorize it to ask.',
        code: 'SUBJECT_TOKEN_NOT_FOR_CALLER',
      }
    }
  }

  if (!payload.exp) {
    return { error: { message: 'The subjectToken must carry an "exp".', code: 'SUBJECT_TOKEN_NOT_BOUNDED' } }
  }
  const issuedAt = payload.iat || payload.nbf
  if (issuedAt && payload.exp - issuedAt > SUBJECT_TOKEN_MAX_SECONDS) {
    return {
      error: {
        message: `The subjectToken lasts longer than the ${SUBJECT_TOKEN_MAX_SECONDS} seconds allowed.`,
        code: 'SUBJECT_TOKEN_TOO_LONG',
      }
    }
  }

  if (!isDid(payload.iss)) {
    return { error: { message: 'The subjectToken has no usable issuer.', code: 'SUBJECT_TOKEN_INVALID' } }
  }
  return { subjectDid: payload.iss }
}

/**
 * @param callerDid the authenticated DID of the calling service
 * @param subjectToken the user's credential to that service, naming it in "aud"
 * @returns {Promise<object>} { status, body } for the caller to send verbatim
 */
export async function membershipResponse(callerDid, subjectToken) {
  if (!callerDid) {
    return {
      status: 401,
      body: { error: { message: 'This endpoint requires an Authorization Bearer JWT.', code: 'UNAUTHENTICATED_SERVICE' } },
    }
  }
  if (!isAllowedServiceDid(callerDid)) {
    // Log the caller, never the credential.
    l.warn(`Membership check refused for non-allowlisted service ${callerDid}`)
    return {
      status: 403,
      body: { error: { message: 'This DID is not permitted to ask about other DIDs.', code: 'SERVICE_NOT_ALLOWED' } },
    }
  }

  const { subjectDid, error } = await subjectFromToken(callerDid, subjectToken)
  if (error) {
    return { status: error.code === 'SUBJECT_TOKEN_NOT_FOR_CALLER' ? 403 : 400, body: { error } }
  }

  const result = await membershipForDid(subjectDid)
  return {
    status: 200,
    body: { did: subjectDid, cacheSeconds: MEMBERSHIP_CACHE_SECONDS, ...result },
  }
}
