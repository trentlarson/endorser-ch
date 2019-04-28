import R from 'ramda'
import { HIDDEN_TEXT, isDid } from '../server/api/services/util'

export function allDidsAreHidden(result) {
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
