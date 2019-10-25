// from https://github.com/uport-project/did-jwt/blob/develop/src/JWT.js
// ... unless we can find a way to access the code directly from the library
import { isMNID } from 'mnid'
import resolve from 'did-resolver'

const SUPPORTED_PUBLIC_KEY_TYPES = {
  ES256K: ['Secp256k1VerificationKey2018', 'Secp256k1SignatureVerificationKey2018', 'EcdsaPublicKeySecp256k1'],
  'ES256K-R': ['Secp256k1VerificationKey2018', 'Secp256k1SignatureVerificationKey2018', 'EcdsaPublicKeySecp256k1']
}

function isDIDOrMNID (mnidOrDid) {
  return mnidOrDid && (mnidOrDid.match(/^did:/) || isMNID(mnidOrDid))
}

function normalizeDID (mnidOrDid) {
  if (mnidOrDid.match(/^did:/)) return mnidOrDid
  if (isMNID(mnidOrDid)) return `did:uport:${mnidOrDid}`
  throw new Error(`Not a valid DID '${mnidOrDid}'`)
}

/**
* Resolves relevant public keys or other authenticating material used to verify signature from the DID document of provided DID
*
*  @example
*  resolveAuthenticator('ES256K', 'did:uport:2nQtiQG6Cgm1GYTBaaKAgr76uY7iSexUkqX').then(obj => {
*      const payload = obj.payload
*      const profile = obj.profile
*      const jwt = obj.jwt
*      ...
*  })
*
*  @param    {String}            alg                a JWT algorithm
*  @param    {String}            did                a Decentralized IDentifier (DID) to lookup
*  @param    {Boolean}           auth               Restrict public keys to ones specifically listed in the 'authentication' section of DID document
*  @return   {Promise<Object, Error>}               a promise which resolves with a response object containing an array of authenticators or if non exist rejects with an error
*/
export async function resolveAuthenticator (alg, mnidOrDid, auth) {
  const types = SUPPORTED_PUBLIC_KEY_TYPES[alg]
  if (!types || types.length === 0) throw new Error(`No supported signature types for algorithm ${alg}`)
  const issuer = normalizeDID(mnidOrDid)
  const doc = await resolve(issuer)
  if (!doc) throw new Error(`Unable to resolve DID document for ${issuer}`)
  const authenticationKeys = auth ? (doc.authentication || []).map(({publicKey}) => publicKey) : true
  const authenticators = (doc.publicKey || []).filter(({type, id}) => types.find(supported => supported === type && (!auth || authenticationKeys.indexOf(id) >= 0)))

  if (auth && (!authenticators || authenticators.length === 0)) throw new Error(`DID document for ${issuer} does not have public keys suitable for authenticating user`)
  if (!authenticators || authenticators.length === 0) throw new Error(`DID document for ${issuer} does not have public keys for ${alg}`)
  return {authenticators, issuer, doc}
}

module.exports = { resolveAuthenticator }
// ... because I couldn't figure out how to import it from this way:
//export default { resolveAuthenticator }
