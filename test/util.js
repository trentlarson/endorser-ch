import R from 'ramda'
import { HIDDEN_TEXT, isDid } from '../server/api/services/util'

let NOW_EPOCH = Math.floor(new Date().getTime() / 1000)
let TOMORROW_EPOCH = NOW_EPOCH + (24 * 60 * 60)

function allDidsAreHidden(result) {
  if (Object.prototype.toString.call(result) === "[object String]") {
    if (isDid(result) && result !== HIDDEN_TEXT) {
      return false
    } else {
      return true
    }
  } else if (result instanceof Object) {
    var values = result
    if (!Array.isArray(result)) {
      // assuming it's an object since it's not an array
      values = R.keys(result).concat(R.values(result))
    }
    return R.reduce((a,b) => a && b, true, R.map(allDidsAreHidden, values))
  } else {
    return true
  }
}

module.exports = {

  nowEpoch: NOW_EPOCH,

  tomorrowEpoch: NOW_EPOCH + (24 * 60 * 60),

  jwtTemplate: {
    "iat": NOW_EPOCH,
    "exp": TOMORROW_EPOCH,
    // supply "sub"
    // supply "claim", usually including same DID of "sub"
    // supply "iss"
  },

  confirmationTemplate: {
    "@context": "http://endorser.ch",
    "@type": "Confirmation",
    "originalClaims": [
      // supply claims
    ]
  },

  allDidsAreHidden: allDidsAreHidden
}

