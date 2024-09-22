import crypto from "crypto";
import didJwt from "did-jwt";

import {PEER_DID_PREFIX, TEST_BYPASS_ENV_VALUE} from "./index";
import {verifyPeerSignature} from "./didPeer";

/**
 *
 * @param payload
 * @param issuerDid
 * @param signatureString
 * @returns {Promise<{claimPayload: string, verified: boolean}>}
 */
export async function verifyJwt(payload, issuerDid, signatureString) {
  if (!payload.iss) {
    return Promise.reject({
      clientError: {
        message: `JWT is missing an "iss" field.`,
      }
    })
  }
  let nowEpoch =  Math.floor(new Date().getTime() / 1000)
  if (!payload.exp) {
    return Promise.reject({
      clientError: {
        message: `JWT with is missing an "exp" field.`,
      }
    })
  }
  if (payload.exp < nowEpoch && process.env.NODE_ENV !== TEST_BYPASS_ENV_VALUE) {
    return Promise.reject({
      clientError: {
        message: `JWT with exp ${payload.exp} has expired.`,
      }
    });
  }

  const authData = payload.AuthenticationDataB64URL
  const clientData = payload.ClientDataJSONB64URL
  if (!authData || !clientData) {
    return Promise.reject({
      clientError: {
        message: `JWT with typ == JWANT requires AuthenticationData and ClientDataJSON.`
      }
    })
  }

  const decodedAuthDataBuff = Buffer.from(authData, 'base64url')
  const decodedClientData = Buffer.from(clientData, 'base64url')

  let claimPayload = JSON.parse(decodedClientData.toString())
  if (claimPayload.challenge) {
    claimPayload = JSON.parse(Buffer.from(claimPayload.challenge, "base64url"))
    if (!claimPayload.exp) {
      claimPayload.exp = payload.exp
    }
    if (!claimPayload.iat) {
      claimPayload.iat = payload.iat
    }
    if (!claimPayload.iss) {
      claimPayload.iss = payload.iss
    }
  }
  if (!claimPayload.exp) {
    return Promise.reject({
      clientError: {
        message: `JWT client data challenge is missing an "exp" field.`,
      }
    })
  }
  if (claimPayload.exp < nowEpoch && process.env.NODE_ENV !== TEST_BYPASS_ENV_VALUE) {
    return Promise.reject({
      clientError: {
        message: `JWT client data challenge exp time is past.`,
      }
    })
  }
  if (claimPayload.exp !== payload.exp) {
    return Promise.reject({
      clientError: {
        message: `JWT client data challenge "exp" field doesn't match the outside payload "exp".`,
      }
    })
  }
  if (claimPayload.iss !== payload.iss) {
    return Promise.reject({
      clientError: {
        message: `JWT client data challenge "iss" field doesn't match the outside payload "iss".`,
      }
    })
  }

  const hashedClientDataBuff = crypto.createHash("sha256")
  .update(decodedClientData)
  .digest()
  const preimage = new Uint8Array(Buffer.concat([decodedAuthDataBuff, hashedClientDataBuff]))
  const PEER_DID_MULTIBASE_PREFIX = PEER_DID_PREFIX + "0"
  // Uint8Array
  const publicKey = didJwt.multibaseToBytes(issuerDid.substring(PEER_DID_MULTIBASE_PREFIX.length));
  const signature = new Uint8Array(Buffer.from(signatureString, 'base64url'))
  const verified = await verifyPeerSignature(preimage, publicKey, signature)
  return { claimPayload, verified }

}
