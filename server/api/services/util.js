import R from 'ramda'
import util from 'util'
import l from '../../common/logger'

// the UI often extracts the address, chops off the first 2 (usually 0x), and shows first and last 3
const HIDDEN_TEXT = 'did:none:HIDDEN' // if you change this, edit uport-demo/src/utilities/claims.js
const UPORT_PUSH_TOKEN_HEADER = 'Uport-Push-Token'

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
  if (!util.isObject(myObject)) {
    return myObject
  } else if (util.isArray(myObject)) {
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
  return value && value.startsWith("did:") && (value.substring(5).indexOf(":") > -1)
}

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

module.exports = { allDidsInside, buildConfirmationList, calcBbox, HIDDEN_TEXT, isDid, UPORT_PUSH_TOKEN_HEADER, withKeysSorted }
