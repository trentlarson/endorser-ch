import R from 'ramda'
import l from '../../common/logger'
import { addCanSee, getAllDidsRequesterCanSee, whoDoesRequestorSeeWhoCanSeeObject } from './network-cache.service'
import { HIDDEN_TEXT, isDid } from './util'

/**
  Accept the original result and the resultHidden with hidden DIDs
  and return the appropriate result:
    - if a map object
      1) for any values that are hidden DIDs, add a key
        - name is a prefix of the same name plus suffix of "VisibleToDids"
        - value is an array of all DIDs who the requester can see & who can see the hidden DID
      2) recurse on all the other values
    - otherwise, recurse if an array, then return it

  Note the quirk with an array of DIDs, where the user will get no information if they're not found within a map-like object.
 **/

async function hideDidsAndAddLinksToNetwork(requesterDid, input) {
  let allowedDids = await getAllDidsRequesterCanSee(requesterDid)
  return hideDidsAndAddLinksToNetworkSub(allowedDids, requesterDid, input)
}

async function hideDidsAndAddLinksToNetworkSub(allowedDids, requesterDid, input) {

  // Note that this process is similar in test util hideDids. If you change one, change both!
  // (Nobody will see this comment... let's just hope they find it during testing.)

  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)) {
      if (allowedDids.indexOf(input) > -1) {
        return input
      } else {
        return HIDDEN_TEXT
      }
    } else {
      return input
    }
  } else if (input instanceof Object) {

    // nestedValues will be an array of Promises
    let nestedValues = R.map(value => hideDidsAndAddLinksToNetworkSub(allowedDids, requesterDid, value))(input)

    let result = {}
    if (!Array.isArray(input)) {
      // it's an object
      for (let key of R.keys(input)) {
        result[key] = await nestedValues[key] // await since each of these is a Promise
      }
      // now look for links to any hidden DIDs
      for (let key of R.keys(input)) {
        if (isDid(key)) {
          // We could get around this by generating suffixes or something, but I don't like that.
          return Promise.reject("Do not use DIDs for keys (because you'll get conflicts in hideDidsAndAddLinksToNetwork).")
        }
        if (result[key] === HIDDEN_TEXT) {
          // add list of anyone else who can see them
          let canSee = await whoDoesRequestorSeeWhoCanSeeObject(requesterDid, input[key])
          if (canSee.length > 0) {
            result[key + "VisibleToDids"] = canSee
          }
        }
      }
    } else {
      // it's an array
      await Promise.all(nestedValues)
        .then(newResults => result = newResults)
    }
    return result
  } else {
    return input
  }
}

async function makeMeGloballyVisible(issuerDid) {
  await addCanSee("*", issuerDid)
    .catch(err => {
      l.error(err, "Got error creating issuer-visible network record for " + issuerDid + " after claim was created.")
      return Promise.reject("Got error creating issuer-visible network record for " + issuerDid + " after claim was created.")
    })
}

module.exports = { hideDidsAndAddLinksToNetwork, hideDidsAndAddLinksToNetworkSub, makeMeGloballyVisible }
