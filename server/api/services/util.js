import R from 'ramda'
import util from 'util'

const HIDDEN_TEXT = '(HIDDEN)'

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

module.exports = { buildConfirmationList, withKeysSorted, HIDDEN_TEXT }
