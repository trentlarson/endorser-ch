// Using 'require' instead of 'import' so that this file can be invoked from the command-line.
const crypto = require('crypto')
const R = require('ramda')
const canonicalize = require("canonicalize");

// the UI often extracts the address, chops off the first 2 (usually 0x), and shows first and last 3
const HIDDEN_TEXT = 'did:none:HIDDEN' // if you change this, edit uport-demo/src/utilities/claims.js
const UPORT_PUSH_TOKEN_HEADER = 'Uport-Push-Token' // deprecated: use Authorization instead

const ERROR_CODES = {
  CANNOT_REGISTER_TOO_SOON: 'CANNOT_REGISTER_TOO_SOON',
  JWT_VERIFY_FAILED: 'JWT_VERIFY_FAILED', // copied from ./vc/index.js, not 'import'ed because we've been running this in raw JS sql-by-hand scripts
  OVER_CLAIM_LIMIT: 'OVER_CLAIM_LIMIT',
  OVER_REGISTRATION_LIMIT: 'OVER_REGISTRATION_LIMIT',
  UNREGISTERED_USER: 'UNREGISTERED_USER',
  UNSUPPORTED_DID_METHOD: 'UNSUPPORTED_DID_METHOD', // copied from ./vc/index.js, not 'import'ed because we've been running this in raw JS sql-by-hand scripts
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
    if (did1.startsWith(ETHR_DID_PREFIX)) {
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

function allEmbeddedRecordErrorsInside(input) {
  if (input instanceof Object) {
    var result = []
    if (!Array.isArray(input)) {
      // it's an object
      for (let key of R.keys(input)) {
        if (key === 'embeddedRecordError') {
          result.push(input['embeddedRecordError'])
        } else {
          result.push(allEmbeddedRecordErrorsInside(input[key]))
        }
      }
    } else {
      // it's an array
      result = R.flatten(input.map(allEmbeddedRecordErrorsInside))
    }
    return R.flatten(result)
  } else {
    return []
  }
}

function inputContainsDid(input, did) {

  if (Object.prototype.toString.call(input) === "[object String]") {
    return input === did
  } else if (input instanceof Object) {

    if (!Array.isArray(input)) {
      // it's an object
      const keys = R.keys(input)
      for (let key of keys) {
        if (inputContainsDid(input[key], did)) {
          return true
        }
      }
      return false
    } else {
      // it's an array
      for (let value of input) {
        if (inputContainsDid(value, did)) {
          return true
        }
      }
      return false
    }
  } else {
    return false
  }
}

// insert a space before any capital letters except the initial letter
// (and capitalize initial letter, just in case)
function capitalizeAndInsertSpacesBeforeCaps(text) {
  return !text
    ? ""
    : text[0].toUpperCase() + text.substr(1).replace(/([A-Z])/g, " $1");
};

function basicClaimDescription(claim) {
  let typeName = capitalizeAndInsertSpacesBeforeCaps(claim['@type'])
  if (typeName.endsWith(" Action")) {
    typeName = typeName.substring(0, typeName.length - " Action".length)
  }
  const name = claim.name ? " '" + claim.name + "'" : ""
  const descr = claim.description ? " - " + claim.description : ""
  return typeName + name + descr;
}

function hashNonceAndDid(nonce, did) {
  const hash = crypto.createHash('sha256')
  hash.update(did + nonce)
  return hash.digest('hex') // let's avoid special characters in the DID, even a fake one
}

// return the input with all DIDs hashed
function replaceDidsWithHashes(nonce, input) {
  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)) {
      return "did:none:noncedhashed:" + hashNonceAndDid(nonce, input)
    } else {
      return input
    }
  } else if (input instanceof Object) {
    return R.map(value => replaceDidsWithHashes(nonce, value))(input)
  } else {
    return input
  }
}

function claimWithHashedDids(nonceAndClaimStrEtc) {
  const input = {
    claim: JSON.parse(nonceAndClaimStrEtc.claimStr),
    issuedAt: nonceAndClaimStrEtc.issuedAt,
    issuerDid: nonceAndClaimStrEtc.issuerDid,
  }
  return canonicalize(replaceDidsWithHashes(nonceAndClaimStrEtc.nonce, input))
}

/**
 This has to include things that make it unique, and the basic claim can be repeated
 by different people or by the same person at different times.
 So we're using "claim" for the payload (since we don't need a VC type, etc)
 and then "issuerDid" and "issuedAt" for the issuer and issued-at time.

 The nonce is still not encoded in the claim, and can selectively reveal any DID part.

 @param nonceAndClaimStrEtc is { "nonce": string, "claimStr": stringified JSON, "issuerDid": string, "issuedAt": number }
 @return parse the claimStr JSON string,
   then hash DID+nonce via hashNonceAndDid
   then wrap in { "claim": JSON, "issuerDid": string, "issuedAt": number }
   then canonicalize
   then sha256-hash
   then hex-encode
 **/
function hashedClaimWithHashedDids(nonceAndClaimStrEtc) {
  const claimStr = claimWithHashedDids(nonceAndClaimStrEtc)
  const hash = crypto.createHash('sha256');
  let result = hash.update(claimStr).digest('base64url')
  //console.log("hash(", claimStr, ") =", result)
  return result
}

function hashPreviousAndNext(prev, next) {
  const hash = crypto.createHash('sha256');
  let result = hash.update(prev + next).digest('base64url')
  //console.log("hash(", prev, "+", next, ") =", result)
  return result
}

/**
 * @see hashedClaimWithHashedDids for the nonceAndClaimStrEtc format
 * @return hex of the latest merkle root of nonceHash values
 */
function nonceHashChain(seed, nonceAndClaimStrEtcList) {
  return R.reduce(
    (prev, nonceAndClaimStrEtc) =>
      hashPreviousAndNext(prev, hashedClaimWithHashedDids(nonceAndClaimStrEtc)),
    seed,
    nonceAndClaimStrEtcList
  )
}

// return base64 of the latest merkle root of base64'd hashed claim strings
function claimHashChain(seed, claimStrList) {
  return R.reduce(
    (prev, claimStr) =>
      hashPreviousAndNext(
        prev,
        crypto.createHash('sha256').update(claimStr).digest('base64url'),
      ),
    seed,
    claimStrList
  )
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

// return an array that contains details of all claimId references in the clause,
// where each element is an object of { lastClaimId || handleId, suppliedType?, clause }
function findAllLastClaimIdsAndHandleIds(clause) {
  let clauseIdsAndHandleIds = []
  // we prefer lastClaimId, we'll take handleId, but we don't want both in the result
  if (clause.lastClaimId) {
    clauseIdsAndHandleIds = [{lastClaimId: clause.lastClaimId, clause}]
  } else if (clause.handleId || (clause.identifier && !isDid(clause.identifier))) {
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

// Find the width of appropriate tiles for a given bounding box:
// given a box in longitude and latitude terms,
// determine a good width and height for tiles
// such there are no less than 4 tiles and no more than 8 tiles on a side
//
// Note that we only take one side, realizing that there is a different
// ratio for the height at different longitudes. So there may be a more
// accurate approach but this is the best I can do based on current research.
//
function latWidthToTileWidth(boxLatWidth) {
  // find a power of 4 that yields 4-8 tiles on the side
  // use 0.0001 as the minimum, approx 11 metere (at the equator)
  const boxLatWidthMultiplied = Math.floor(boxLatWidth * 100000)
  const boxMinPower = Math.log(boxLatWidthMultiplied) / Math.log(2)
  const boxMinPowerLower = boxMinPower - 2
  const boxMinPowerRounded = Math.max(Math.floor(boxMinPowerLower), 1)
  // we'll use 4^boxMinAsPowerRounded as the size of one tile
  const latTileSize = Math.pow(2, boxMinPowerRounded) / 100000

  return latTileSize
}

/**
 *
 * @param boxMinLat minimum latitude chosen for the tile for this bounding box
 * @param boxMinLon minimum longitude chosen for the tile for this bounding box
 * @param tileWidth width of each tile
 * @param tile result of DB query: { indexLat, indexLon, minFoundLat, minFoundLon, maxFoundLat, maxFoundLon, recordCount }
 * @returns tile with minLat, minLon instead of indexLat, indexLon
 */
function latLonFromTile(boxMinLat, boxMinLon, tileWidth) {
  return (tile) => ({
    minLat: boxMinLat + tile.indexLat * tileWidth,
    minLon: boxMinLon + tile.indexLon * tileWidth,
    ...tile
  })
}

module.exports = {
  allDidsInside, allEmbeddedRecordErrorsInside, basicClaimDescription,
  buildConfirmationList, calcBbox, claimHashChain, ERROR_CODES,
  GLOBAL_ENTITY_ID_IRI_PREFIX, findAllLastClaimIdsAndHandleIds,
  globalFromLocalEndorserIdentifier, globalId,
  hashedClaimWithHashedDids, hashPreviousAndNext, HIDDEN_TEXT,
  inputContainsDid, latLonFromTile, latWidthToTileWidth,
  localFromGlobalEndorserIdentifier, isDid, isGlobalEndorserHandleId,
  isGlobalUri, nonceHashChain, UPORT_PUSH_TOKEN_HEADER, withKeysSorted
}
