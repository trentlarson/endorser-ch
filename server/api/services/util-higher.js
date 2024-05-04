import R from 'ramda'
import l from '../../common/logger'
import { addCanSee, getAllDidsRequesterCanSee, getPublicDidUrl, getDidsSeenByAll, whoDoesRequesterSeeWhoCanSeeObject } from './network-cache.service'
import { HIDDEN_TEXT, isDid } from './util'

/**
  Accept the original result and return the result for the given user
  where, if a DID is not visible to this user, it is hidden but connected DIDs are shown.
    - if a non-map object, replace any non-visible DIDs with HIDDEN_DID value
      ... but non-map usage is _DISCOURAGED_ because then the "publicUrls" can't be added
    - if a map object
      - recurse on values
      - if any values are HIDDEN_DID, add a key
        - name is a prefix of the same name plus suffix of "VisibleToDids"
        - value is an array of all DIDs who the requester can see & who can see the hidden DID
      - if any DIDs are public, add a "publicUrls" key at the top level with value of a map from DID to URL
 **/

async function hideDidsAndAddLinksToNetwork(requesterDid, input, searchTermMaybeDIDs = []) {
  const validSearchTermMaybeDIDs = searchTermMaybeDIDs.filter(R.identity) // exclude any undefined/null/empty
  let allowedDids = await getAllDidsRequesterCanSee(requesterDid)
  let result
  if (Array.isArray(input)) {
    result = []
    for (let item of input) {
      if (requesterDid && item?.issuer === requesterDid) {
        // allow all visibility for the issuer
        result = R.append(item, result)
      } else {
        const oneResult = await hideDidsAndAddLinksToNetworkSub(allowedDids, requesterDid, item)
        // Only include any element where the result still includes the search term
        // because we shouldn't allow someone to search for a DID (or parts) and get activity that's hidden.
        // (Other criteria are OK for searches for non-personal information, just not DID material.)
        let allMatch = R.all((term) => JSON.stringify(oneResult).includes(term), validSearchTermMaybeDIDs)
        if (allMatch) {
          result = R.append(oneResult, result)
        } else {
          // don't include it
        }
      }
    }
  } else {
    if (requesterDid && input?.issuer === requesterDid) {
      result = input
    } else {
      result = await hideDidsAndAddLinksToNetworkSub(allowedDids, requesterDid, input)
    }
  }

  // ensure the public URL lookup is initialized
  await getDidsSeenByAll()
  let publicUrls = gatherPublicUrls(result)
  if (R.length(R.keys(publicUrls)) > 0) {
    result["publicUrls"] = publicUrls
  }
  //l.trace(result, "Final API result")

  return result
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
      const keys = R.keys(input)
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i]
        let canSee = []
        if (result[key] === HIDDEN_TEXT) {
          // add to list of anyone else who can see them
          canSee = await whoDoesRequesterSeeWhoCanSeeObject(requesterDid, input[key])
        } else if (Array.isArray(result[key])) {
          // add to list of anyone else who can see them
          for (let i = 0; i < result[key].length; i++) {
            if (result[key][i] === HIDDEN_TEXT) {
              let newCanSee = await whoDoesRequesterSeeWhoCanSeeObject(requesterDid, input[key][i])
              canSee = R.uniq(R.concat(canSee, newCanSee))
            }
          }
        }
        // Using DIDs as keys doesn't make much sense in VCs. OK: hide 'em all.
        if (isDid(key)) {
          const newKey = HIDDEN_TEXT + '_' + i
          result[newKey] = result[key]
          delete result[key]
          key = newKey
        }
        if (canSee.length > 0) {
          result[key + "VisibleToDids"] = canSee
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

// make a map of {DID:URL} for every embedded public DID
function gatherPublicUrls(input) {
  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)
        && getPublicDidUrl(input) !== undefined) {
      var result = {}
      result[input] = getPublicDidUrl(input)
      return result
    } else {
      return null
    }
  } else if (input instanceof Object) {

    // nestedValues will be an object map or array
    var nestedValues = R.map(value => gatherPublicUrls(value))(input)

    if (!Array.isArray(input)) {
      // it's an object, so extract all the values
      nestedValues = R.values(nestedValues)
    }
    // now nestedValues is an array

    return R.mergeAll(R.flatten(nestedValues))
  } else {
    return null
  }
}

async function makeGloballyVisible(issuerDid, url) {
  await addCanSee("*", issuerDid, url)
    .catch(err => {
      l.error(err, "Got error creating issuer-visible network record for " + issuerDid)
      return Promise.reject("Got error creating issuer-visible network record for " + issuerDid)
    })
}

module.exports = { hideDidsAndAddLinksToNetwork, hideDidsAndAddLinksToNetworkSub /* for tests */, getPublicDidUrl, makeGloballyVisible }
