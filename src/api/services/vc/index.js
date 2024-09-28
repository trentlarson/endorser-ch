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

import {didEthLocalResolver} from "./did-eth-local-resolver";
import {verifyJwt as peerVerifyJwt} from "./passkeyDidPeer";

export const TEST_BYPASS_ENV_VALUE = "test-local";
export const ETHR_DID_PREFIX = 'did:ethr:'
export const PEER_DID_PREFIX = 'did:peer:'
export const JWT_VERIFY_FAILED_CODE = "JWT_VERIFY_FAILED"
export const UNSUPPORTED_DID_METHOD_CODE = "UNSUPPORTED_DID_METHOD"

const resolver = new Resolver({ 'ethr': didEthLocalResolver });
  // Here's the previous code using the getResolver from ethr-did-resolver 6.2.2 (and did-jwt 7.4.7)
  // new Resolver({
  //   ...getResolver({
  //     infuraProjectId: process.env.INFURA_PROJECT_ID
  //   })
  // });

// return Promise of at least { issuer, payload, verified boolean }
// ... and also if successfully verified by did-jwt (not JWANT): data, doc, signature, signer
export async function decodeAndVerifyJwt(jwt) {
  const pieces = jwt.split('.')
  const header = JSON.parse(base64url.decode(pieces[0]))
  const payload = JSON.parse(base64url.decode(pieces[1]))
  const issuerDid = payload.iss
  if (!issuerDid) {
    return Promise.reject({
      clientError: {
        message: `Missing "iss" field in JWT.`,
      }
    })
  }

  if (issuerDid.startsWith(ETHR_DID_PREFIX)) {
    try {
      const verified = await didJwt.verifyJWT(jwt, {resolver})
      return verified

    } catch (e) {
      return Promise.reject({
        clientError: {
          message: `JWT failed verification: ` + e.toString(),
          code: JWT_VERIFY_FAILED_CODE
        }
      })
    }
  }

  if (issuerDid.startsWith(PEER_DID_PREFIX) && header.typ === "JWANT") {
    const { claimPayload, verified } = await peerVerifyJwt(payload, issuerDid, pieces[2])
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
