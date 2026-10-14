/**
 * Verifiable Credential & DID functions, specifically for EndorserSearch.org tools
 *
 * The goal is to make this folder similar across projects, then move it to a library.
 * Other projects: crowd-funder-for-time-pwa, image-api
 *
 */

import base64url from "base64url";
import didJwt from "did-jwt";
import {Resolver} from "did-resolver";

import l from "../../../common/logger";
import {didEthLocalResolver} from "./did-eth-local-resolver";
import {verifyJwt as peerVerifyJwt} from "./passkeyDidPeer";

export const TEST_BYPASS_ENV_VALUE = "test-local";
export const ETHR_DID_PREFIX = 'did:ethr:'
export const PEER_DID_PREFIX = 'did:peer:'
export const JWT_VERIFY_FAILED_CODE = "JWT_VERIFY_FAILED"
export const UNSUPPORTED_DID_METHOD_CODE = "UNSUPPORTED_DID_METHOD"
export const INVALID_AUDIENCE_CODE = "INVALID_AUDIENCE"

// Identifies this deployment when a client binds a credential to it with "aud".
// Any agreed string works: nothing is verified against this value, it is compared
// for equality. Leave it unset to ignore "aud" entirely, which is what lets
// clients adopt the field before a deployment enforces it.
const SERVICE_AUDIENCE_ID = process.env.SERVICE_AUDIENCE_ID

// Set once every client sends "aud". Until then a credential without one is
// accepted, so existing deployments and clients keep working.
const SERVICE_AUDIENCE_REQUIRED = process.env.SERVICE_AUDIENCE_REQUIRED === "true"

// Reporting on credentials that arrive without an "aud", so that the switch to
// SERVICE_AUDIENCE_REQUIRED can wait until this goes quiet. Silence means every
// caller sends one. These are l.warn, so they need LOG_LEVEL=warn or lower; the
// default level is "error".
const UNAUDIENCED_LOG_INTERVAL_MS =
      parseInt(process.env.UNAUDIENCED_LOG_INTERVAL_MS || String(60 * 60 * 1000), 10)
// Cap the sample: a caller can mint unlimited DIDs, so this must not grow with them.
const UNAUDIENCED_SAMPLE_MAX = 20
let unaudiencedCount = 0
let unaudiencedIssuers = new Set()
let unaudiencedWindowStart = Date.now()

function noteUnaudiencedCredential(issuerDid) {
  unaudiencedCount += 1
  if (unaudiencedIssuers.size < UNAUDIENCED_SAMPLE_MAX) {
    unaudiencedIssuers.add(issuerDid)
  }
  const now = Date.now()
  if (now - unaudiencedWindowStart < UNAUDIENCED_LOG_INTERVAL_MS) {
    return
  }
  const sample = Array.from(unaudiencedIssuers)
  const truncated = unaudiencedIssuers.size >= UNAUDIENCED_SAMPLE_MAX ? " (sample truncated)" : ""
  l.warn(
    `Credentials without "aud": ${unaudiencedCount} in the last `
    + `${Math.round((now - unaudiencedWindowStart) / 60000)} minutes, from issuers `
    + `${sample.join(", ")}${truncated}. `
    + `Set SERVICE_AUDIENCE_REQUIRED once this stops appearing.`
  )
  unaudiencedCount = 0
  unaudiencedIssuers = new Set()
  unaudiencedWindowStart = now
}

const resolver = new Resolver({ 'ethr': didEthLocalResolver });
  // Here's the previous code using the getResolver from ethr-did-resolver 6.2.2 (and did-jwt 7.4.7)
  // new Resolver({
  //   ...getResolver({
  //     infuraProjectId: process.env.INFURA_PROJECT_ID
  //   })
  // });

/**
 * Audience rules, applied only to credentials (not to claims, which are portable
 * by design and carry no audience).
 *
 * - no SERVICE_AUDIENCE_ID configured: "aud" is ignored. Note that did-jwt's own
 *   default is to *reject* any JWT carrying "aud" when no audience is configured,
 *   which would break clients that adopt the field first, so it is disabled here.
 * - configured: a mismatched "aud" is rejected; a missing one is accepted unless
 *   SERVICE_AUDIENCE_REQUIRED is set.
 *
 * @returns a clientError object when the payload should be rejected, else null
 */
function audienceError(payload, enforcing) {
  if (!enforcing) {
    return null
  }
  if (!payload.aud) {
    if (SERVICE_AUDIENCE_REQUIRED) {
      return { message: `JWT is missing the "aud" field.`, code: INVALID_AUDIENCE_CODE }
    }
    noteUnaudiencedCredential(payload.iss)
    return null
  }
  const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  return audArray.includes(SERVICE_AUDIENCE_ID)
    ? null
    : { message: `JWT "aud" does not name this service.`, code: INVALID_AUDIENCE_CODE }
}

// return Promise of at least { issuer, payload, verified boolean }
// ... and also if successfully verified by did-jwt (not JWANT): data, doc, signature, signer
//
// Pass { checkAudience: true } on the credential path. Claims are portable and
// must not be audience-bound, so they are verified without it.
export async function decodeAndVerifyJwt(jwt, { checkAudience = false } = {}) {
  const enforcingAudience = checkAudience && !!SERVICE_AUDIENCE_ID
  const pieces = jwt.split('.')
  let header, payload;
  try {
    header = JSON.parse(base64url.decode(pieces[0]))
    payload = JSON.parse(base64url.decode(pieces[1]))
  } catch (e) {
    return Promise.reject({
      clientError: {
        message: `Error parsing JWT header or payload: ` + e.toString(),
        code: JWT_VERIFY_FAILED_CODE,
      }
    })
  }
  const issuerDid = payload.iss
  if (!issuerDid) {
    return Promise.reject({
      clientError: {
        message: `Missing "iss" field in JWT.`,
        code: JWT_VERIFY_FAILED_CODE,
      }
    })
  }

  if (issuerDid.startsWith(ETHR_DID_PREFIX)) {
    try {
      const verifyOptions = enforcingAudience
        // did-jwt tolerates a missing "aud"; audienceError decides on that case.
        ? { resolver, audience: SERVICE_AUDIENCE_ID }
        // Disable did-jwt's audience handling so a credential carrying "aud"
        // is not rejected merely because this deployment has none configured.
        : { resolver, policies: { aud: false } }
      const verifiedResult = await didJwt.verifyJWT(jwt, verifyOptions)
      const audFailure = audienceError(verifiedResult.payload, enforcingAudience)
      if (audFailure) {
        return Promise.reject({ clientError: audFailure })
      }
      return verifiedResult

    } catch (e) {
      // did-jwt raises its own audience mismatch before the check above runs, and
      // labels it with a generic code, so surface it as an audience problem to
      // give a client something actionable when its "aud" is misconfigured.
      const isAudience = e.toString().includes('audience')
      return Promise.reject({
        clientError: {
          message: `JWT failed verification: ` + e.toString(),
          code: isAudience ? INVALID_AUDIENCE_CODE : JWT_VERIFY_FAILED_CODE,
        }
      })
    }
  }

  if (issuerDid.startsWith(PEER_DID_PREFIX) && header.typ === "JWANT") {
    const { claimPayload, verified } = await peerVerifyJwt(payload, issuerDid, pieces[2])
    // peerVerifyJwt does not inspect "aud", so without this the did:peer path
    // would be an audience-check bypass.
    const audFailure = audienceError(claimPayload, enforcingAudience)
    if (audFailure) {
      return Promise.reject({ clientError: audFailure })
    }
    return { issuer: issuerDid, payload: claimPayload, verified: verified }
  }

  if (issuerDid.startsWith(PEER_DID_PREFIX)) {
    return Promise.reject({
      clientError: {
        message: `JWT with a PEER DID currently only supported with typ == JWANT. Contact us us for JWT suport since it should be straightforward.`
      }
    })
  }

  return Promise.reject({
    clientError: {
      message: `Unsupported DID method ${issuerDid}`,
      code: UNSUPPORTED_DID_METHOD_CODE
    }
  })
}
