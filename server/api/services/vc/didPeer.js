import { AsnParser } from "@peculiar/asn1-schema";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import crypto from "crypto";
import { decode as cborDecode } from "cbor-x";

/**
 *
 *
 * similar code is in crowd-funder-for-time-pwa libs/crypto/vc/passkeyDidPeer.ts verifyJwtWebCrypto
 *
 * @returns {Promise<boolean>}
 */
export async function verifyPeerSignature(payloadBytes, publicKeyBytes, signatureBytes) {
  // this simple approach doesn't work
  //const verify = crypto.createVerify('sha256')
  //verify.update(preimage)
  //const result = verify.verify(publicKey, signature)

  const finalSignatureBuffer = unwrapEC2Signature(signatureBytes);
  const verifyAlgorithm = {
    name: "ECDSA",
    hash: { name: "SHA-256" },
  };
  const publicKeyJwk = cborToKeys(publicKeyBytes).publicKeyJwk;
  const keyAlgorithm = {
    name: "ECDSA",
    namedCurve: publicKeyJwk.crv,
  };
  const publicKeyCryptoKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    keyAlgorithm,
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    verifyAlgorithm,
    publicKeyCryptoKey,
    finalSignatureBuffer,
    payloadBytes,
  );
  return verified;
}

function cborToKeys(publicKeyBytes /* Uint8Array*/) {
  const jwkObj = cborDecode(publicKeyBytes);
  if (
    jwkObj[1] != 2 || // kty "EC"
    jwkObj[3] != -7 || // alg "ES256"
    jwkObj[-1] != 1 || // crv "P-256"
    jwkObj[-2].length != 32 || // x
    jwkObj[-3].length != 32 // y
  ) {
    throw new Error("Unable to extract key.");
  }
  const publicKeyJwk = {
    alg: "ES256",
    crv: "P-256",
    kty: "EC",
    x: arrayToBase64Url(jwkObj[-2]),
    y: arrayToBase64Url(jwkObj[-3]),
  };
  const publicKeyBuffer = Buffer.concat([
    Buffer.from(jwkObj[-2]),
    Buffer.from(jwkObj[-3]),
  ]);
  return { publicKeyJwk, publicKeyBuffer };
}

function toBase64Url(anythingB64 /* string */) {
  return anythingB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function arrayToBase64Url(anything /* Uint8Array*/) {
  return toBase64Url(Buffer.from(anything).toString("base64"));
}

/**
 * In WebAuthn, EC2 signatures are wrapped in ASN.1 structure so we need to peel r and s apart.
 *
 * See https://www.w3.org/TR/webauthn-2/#sctn-signature-attestation-types
 *
 * @return Uint8Array of the signature inside
 */
function unwrapEC2Signature(signature /* Uint8Array */) {
  const parsedSignature = AsnParser.parse(signature, ECDSASigValue);
  let rBytes = new Uint8Array(parsedSignature.r);
  let sBytes = new Uint8Array(parsedSignature.s);

  if (shouldRemoveLeadingZero(rBytes)) {
    rBytes = rBytes.slice(1);
  }

  if (shouldRemoveLeadingZero(sBytes)) {
    sBytes = sBytes.slice(1);
  }

  const finalSignature = isoUint8ArrayConcat([rBytes, sBytes]);

  return finalSignature;
}

/**
 * Determine if the DER-specific `00` byte at the start of an ECDSA signature byte sequence
 * should be removed based on the following logic:
 *
 * "If the leading byte is 0x0, and the high order bit on the second byte is not set to 0,
 * then remove the leading 0x0 byte"
 *
 * @return true if leading zero should be removed
 */
function shouldRemoveLeadingZero(bytes /* Uint8Array */) {
  return bytes[0] === 0x0 && (bytes[1] & (1 << 7)) !== 0;
}

// from https://github.com/MasterKale/SimpleWebAuthn/blob/master/packages/server/src/helpers/iso/isoUint8Array.ts#L49
/**
 * Combine multiple Uint8Arrays into a single Uint8Array
 *
 * @param arrays - Uint8Array[]
 * @return Uint8Array
 */
function isoUint8ArrayConcat(arrays /* Uint8Array[] */) {
  let pointer = 0;
  const totalLength = arrays.reduce((prev, curr) => prev + curr.length, 0);

  const toReturn = new Uint8Array(totalLength);

  arrays.forEach((arr) => {
    toReturn.set(arr, pointer);
    pointer += arr.length;
  });

  return toReturn;
}
