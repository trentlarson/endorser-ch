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
 * @param callerDid the authenticated DID of the calling service
 * @param subjectDid the DID being asked about
 * @returns {Promise<object>} { status, body } for the caller to send verbatim
 */
export async function membershipResponse(callerDid, subjectDid) {
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
  if (!isDid(subjectDid)) {
    return {
      status: 400,
      body: { error: { message: 'Supply a subject DID.', code: 'INVALID_SUBJECT_DID' } },
    }
  }

  const result = await membershipForDid(subjectDid)
  return {
    status: 200,
    body: { did: subjectDid, cacheSeconds: MEMBERSHIP_CACHE_SECONDS, ...result },
  }
}
