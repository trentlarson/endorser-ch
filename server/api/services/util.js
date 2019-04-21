import R from 'ramda'
import util from 'util'

const HIDDEN_TEXT = 'did::U CANNOT C'
const PUSH_TOKEN_HEADER = 'Uport-Push-Token'

// create confirmation list from a list of actionClaimsAndConfirmations for the same action
// internal helper function
function buildConfirmationList(acacList) {
  return {
    action: acacList[0].action,
    confirmations: (acacList.length == 1 && !acacList[0].confirmation)
      ? []
      : R.map(acac=>acac.confirmation)(acacList)
  }
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

module.exports = { buildConfirmationList, calcBbox, HIDDEN_TEXT, PUSH_TOKEN_HEADER, withKeysSorted }
