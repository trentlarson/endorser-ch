const crypto = require('crypto')
const R = require('ramda')
const util = require('util')

// the UI often extracts the address, chops off the first 2 (usually 0x), and shows first and last 3
const HIDDEN_TEXT = 'did:none:HIDDEN' // if you change this, edit uport-demo/src/utilities/claims.js
const UPORT_PUSH_TOKEN_HEADER = 'Uport-Push-Token' // deprecated: use Authorization instead

const ERROR_CODES = {
  CANNOT_REGISTER_TOO_SOON: 'CANNOT_REGISTER_TOO_SOON',
  JWT_VERIFY_FAILED: 'JWT_VERIFY_FAILED',
  OVER_CLAIM_LIMIT: 'OVER_CLAIM_LIMIT',
  OVER_REGISTRATION_LIMIT: 'OVER_REGISTRATION_LIMIT',
  UNREGISTERED_USER: 'UNREGISTERED_USER',
}

// This is an expected ID prefix for this system.
const GLOBAL_ID_IRI_PREFIX = process.env.GLOBAL_ID_IRI_PREFIX || 'https://endorser.ch'
const GLOBAL_ENTITY_ID_IRI_PREFIX = GLOBAL_ID_IRI_PREFIX + '/entity/'

const globalFromLocalEndorserIdentifier = (id) => GLOBAL_ENTITY_ID_IRI_PREFIX + id
const isGlobalEndorserHandleId = (id) => id && id.startsWith(GLOBAL_ENTITY_ID_IRI_PREFIX)
const localFromGlobalEndorserIdentifier = (id) => id.substring(GLOBAL_ENTITY_ID_IRI_PREFIX.length)

const globalId = (id) =>
    (!id || isGlobalUri(id)) ? id : globalFromLocalEndorserIdentifier(id)

/**
   Take KEY and a list of claims-and-confirmations for the same claim
   and return an object with properties of:
     - KEY: for the data
     - "confirmations": for the list of confirmations
**/
function buildConfirmationList(key, cacList) {
  let result = {
    confirmations: (cacList.length == 1 && !cacList[0].confirmation)
      ? []
      : R.map(cac => cac.confirmation)(cacList)
  }
  result[key] = cacList[0][key]
  return result
}

function withKeysSorted(myObject) {
  if (myObject === null || typeof myObject !== 'object') {
    // not an object
    return myObject
  } else if (Array.isArray(myObject)) {
    var result = []
    for (var elem of myObject) {
      result.push(withKeysSorted(elem))
    }
    return result
  } else {
    var result = {}
    let keys = R.keys(myObject)
    let keysSorted = keys.sort((a,b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    for (var key of keys) {
      let value = withKeysSorted(myObject[key])
      result[key] = value
    }
    return result
  }
}

function calcBbox(polygonStr) {
  // get an array of lat-lon 2-element arrays
  let allPairs = R.map(R.split(','), R.split(' ', polygonStr))

  // get all the latitudes
  let allLats = R.map(Number,R.map(R.nth(0), allPairs))
  let minlat = R.reduce(R.min, allLats[0], R.tail(allLats))
  let maxlat = R.reduce(R.max, allLats[0], R.tail(allLats))

  // get all the longitudes and fid max & min
  // (note that this is not correct around the antimeridian)
  let allLons = R.map(Number,R.map(R.nth(1), allPairs))
  let minlon = R.reduce(R.min, allLons[0], R.tail(allLons))
  let maxlon = R.reduce(R.max, allLons[0], R.tail(allLons))

  let bbox = { westLon:minlon, minLat:minlat, eastLon:maxlon, maxLat:maxlat }
  return bbox
}

function isDid(value) {
  return value && value.startsWith("did:")
}

/**
 * from https://tools.ietf.org/html/rfc3986#section-3
 * also useful is https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Definition
 **/
function isGlobalUri(uri) {
  return uri && uri.match(new RegExp(/^[A-Za-z][A-Za-z0-9+.-]+:/));
}

/**
 *
 * This was an attempt to handle check-summed ethr DIDs.
 * But this opens a can of worms.
 * Better to leave the search uncomplicated and let the client handle it.
 *
// return false if either are not DIDs (even if equivalent strings),
// otherwise true if they're equivalent, even for mismatched-case "did:ethr:" DIDs
function equivalentDids(did1, did2) {
  if (isDid(did1) && isDid(did2)) {
    if (did1.startsWith('did:ethr:')) {
      did1 = did1.toLowerCase()
      did2 = did2.toLowerCase()
    }
    return did1 === did2
  } else {
    return false
  }
}
**/

function allDidsInside(input) {

  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)) {
      return [input]
    } else {
      return []
    }
  } else if (input instanceof Object) {

    var result = []
    if (!Array.isArray(input)) {
      // it's an object
      for (let key of R.keys(input)) {
        result = R.concat(result, allDidsInside(input[key]))
      }
    } else {
      // it's an array
      result = R.map(allDidsInside)(input)
    }
    return R.uniq(R.flatten(result))
  } else {
    return []
  }
}

function hashNonceAndDid(nonce, did) {
  const hash = crypto.createHash('sha256')
  hash.update(did + nonce)
  return hash.digest('hex')
}

// return the input with all DIDs hashed
function replaceDidsWithHashes(nonce, input) {
  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)) {
      return "did:none:hashed:" + hashNonceAndDid(nonce, input)
    } else {
      return input
    }
  } else if (input instanceof Object) {
    return R.map(value => replaceDidsWithHashes(nonce, value))(input)
  } else {
    return input
  }
}

function claimWithHashedDids(nonceAndClaimStr) {
  return JSON.stringify(
    replaceDidsWithHashes(nonceAndClaimStr.nonce, JSON.parse(nonceAndClaimStr.claim))
  )
}

/**
 @param idAndClaim is { "nonce": String, "claim": Stringified JSON }
 @return hex-encoded hashed JSON string where all DIDs are hashed via hashNonceAndDid
 **/
function hashedClaimWithHashedDids(nonceAndClaimStr) {
  const claimStr = claimWithHashedDids(nonceAndClaimStr)
  const hash = crypto.createHash('sha256');
  hash.update(claimStr)
  let result = hash.digest('hex')
  //console.log("hash(", claimStr, ") =", result)
  return result
}

function hashPreviousAndNext(prev, next, encoding) {
  const hash = crypto.createHash('sha256');
  hash.update(prev)
  hash.update(next)
  let result = hash.digest(encoding)
  //console.log("hash(", prev, "+", next, ") =", result)
  return result
}

// return hex of the latest merkle root of nonceHashHex values
function nonceHashChain(seed, nonceAndClaimStrList) {
  return R.reduce(
    (prev, nonceAndClaimStr) =>
      hashPreviousAndNext(prev, hashedClaimWithHashedDids(nonceAndClaimStr), 'hex'),
    seed,
    nonceAndClaimStrList
  )
}

// return hex of the latest merkle root of base64'd hashed claim strings (which probably should be canonical)
function claimHashChain(seed, claimStrList) {
  return R.reduce(
    (prev, claimStr) =>
      hashPreviousAndNext(
        prev,
        crypto.createHash('sha256').update(claimStr).digest('base64'),
        'base64'
      ),
    seed,
    claimStrList
  )
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

// return an array that contains all claimId properties,
// where each value is an object of { lastClaimId || handleId, suppliedType, clause }
function findAllLastClaimIdsAndHandleIds(clause) {
  let clauseIdsAndHandleIds = []
  // we prefer lastClaimId, we'll take handleId, but we don't want both in the result
  if (clause.lastClaimId) {
    clauseIdsAndHandleIds = [{lastClaimId: clause.lastClaimId, clause}]
  } else if (clause.handleId || clause.identifier) {
    clauseIdsAndHandleIds = [{handleId: clause.handleId || clause.identifier, clause}]
  }
  if (clauseIdsAndHandleIds.length > 0
      && clause['@type']) {
    clauseIdsAndHandleIds = [R.mergeLeft(clauseIdsAndHandleIds[0], {suppliedType: clause['@type']})]
  }
  for (let key in clause) {
    if (Array.isArray(clause[key])) {
      for (let value of clause[key]) {
        if (isObject(value)) {
          clauseIdsAndHandleIds = R.concat(clauseIdsAndHandleIds, findAllLastClaimIdsAndHandleIds(value))
        }
      }
    } else {
      if (isObject(clause[key])) {
        clauseIdsAndHandleIds = R.concat(clauseIdsAndHandleIds, findAllLastClaimIdsAndHandleIds(clause[key]))
      }
    }
  }
  return clauseIdsAndHandleIds
}

module.exports = { allDidsInside, buildConfirmationList, calcBbox, claimHashChain, ERROR_CODES, GLOBAL_ENTITY_ID_IRI_PREFIX, findAllLastClaimIdsAndHandleIds, globalFromInternalIdentifier: globalFromLocalEndorserIdentifier, globalId, hashedClaimWithHashedDids, HIDDEN_TEXT, localFromGlobalEndorserIdentifier, isDid, isGlobalEndorserHandleId, isGlobalUri, nonceHashChain, UPORT_PUSH_TOKEN_HEADER, withKeysSorted }

