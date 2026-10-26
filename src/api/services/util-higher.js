import R from 'ramda'
import l from '../../common/logger'
import { addCanSee, getAllDidsRequesterCanSee, getPublicDidUrl, getDidsSeenByAll, whoDoesRequesterSeeWhoCanSeeObject } from './network-cache.service'
import { allDidsInside, HIDDEN_TEXT, inputContainsDid, isDid } from './util'

/**
 * What a requester may see of the DIDs in a result. Its shape is plain JSON so
 * that a service without the main DB (eg. partner features once split out)
 * can get it from the main service in one call.
 *
 * @typedef {object} DidVisibility
 * @property {string[]} visibleDids - the asked-for DIDs the requester can see
 * @property {object} visibleToDids - for each other asked-for DID, the DIDs the requester can see who can see it
 * @property {object} publicUrls - for each public DID among the asked-for DIDs and those in visibleToDids,
 *   its URL ('' when it has none)
 */

/**
 * The DidVisibility for some DIDs, from this process's network cache.
 *
 * @param requesterDid {string} the DID of the user making the request
 * @param dids {string[]} the DIDs to ask about
 * @returns {Promise<DidVisibility>}
 */
async function visibilityFromNetworkCache(requesterDid, dids) {
  const allowedDids = await getAllDidsRequesterCanSee(requesterDid)
  const visibleDids = dids.filter((did) => allowedDids.includes(did))
  const hiddenDids = dids.filter((did) => !allowedDids.includes(did) && did !== HIDDEN_TEXT)
  const linkLists = await Promise.all(hiddenDids.map((did) => whoDoesRequesterSeeWhoCanSeeObject(requesterDid, did)))
  const visibleToDids = R.zipObj(hiddenDids, linkLists)

  await getDidsSeenByAll() // loads the public URLs
  const publicUrls = {}
  for (const did of R.uniq([...visibleDids, ...R.flatten(linkLists)])) {
    if (getPublicDidUrl(did) !== undefined) {
      publicUrls[did] = getPublicDidUrl(did)
    }
  }
  return { visibleDids, visibleToDids, publicUrls }
}

/**
 * Call hideDidsAndAddLinksToNetwork but where input is expected to have a
 * key (eg. "data") with the data to hide, so that the process starts there,
 * and then any "publicUrls" are moved to the top level.
 *
 * The value in the key is expected to follow the rules for "issuer" or "issuerDid".
 *
 * @see #hideDidsAndAddLinksToNetwork
 * @returns {Promise<object>} which returns the input but with the key replaced
 * and with any publicUrls moved to the top level
 */
async function hideDidsAndAddLinksToNetworkInDataKey(requesterDid, input, searchTerms, lookupVisibility) {
  const result = await hideDidsAndAddLinksToNetwork(requesterDid, input["data"], searchTerms, lookupVisibility)
  if (result && result["publicUrls"]) {
    input["publicUrls"] = result["publicUrls"]
    delete result["publicUrls"]
  }
  input["data"] = result
  return input
}

/**
 * Remove the "publicUrls" that hideDidsAndAddLinksToNetwork puts on each
 * scrubbed array (where JSON would drop them) and merge them into one map,
 * for the top level of a response with several lists.
 *
 * @param lists {array} the scrubbed arrays
 * @returns {object} map from DID to URL, empty if there are none
 */
function takePublicUrls(lists) {
  const result = {}
  for (const list of lists) {
    if (list && list["publicUrls"]) {
      Object.assign(result, list["publicUrls"])
      delete list["publicUrls"]
    }
  }
  return result
}

/**
  Accept the original result and return the result for the given user
  where, if a DID is not visible to this user, it is hidden but connected DIDs are shown.
    - if a non-map object, replace any non-visible DIDs with HIDDEN_DID value
      ... but non-map usage is _DISCOURAGED_ because then the "publicUrls" either get lost or show as a key in an array which is weird (see below)
    - if a map object
      - recurse on values
      - if any values are HIDDEN_DID and are visible to someone else in user's network, add a key
        - name is a prefix of the same name plus suffix of "VisibleToDids"
        - value is an array of all DIDs who the requester can see & who can see the hidden DID
      - if any DIDs are public, add a "publicUrls" key at the top level with value of a map from DID to URL

  Note that we want this object or each element of this array (recursively)
  to have a key of either "issuer" or "issuerDid" if it contains any DIDs
  so that the data isn't hidden from this person who might be the issuer.
  (If it's there we can show everything. If not, we'll run the algo to hide.)

  Only a string that is a DID (or starts with "did:") is treated as a DID,
  so a DID inside other text (eg. a description) is left as it is.

  @param requesterDid {string} the DID of the user making the request
  @param input {object|array|string} the result to be scrubbed
  @param searchTerms {array} an array of strings that are in search terms
  -- since they may be DIDs or parts of DIDs, and we don't want to show those results if the user doesn't have visibility to them
  @param lookupVisibility {function} optional (requesterDid, dids) => Promise<DidVisibility>; defaults to this process's network cache
  @returns {Promise<object|array|string>} the result with DIDs hidden, key + "VisibleToDids" added,
    and links to DIDs with published URLs added as "publicUrls" key (for both objects and arrays)
 **/
async function hideDidsAndAddLinksToNetwork(requesterDid, inputData, searchTerms, lookupVisibility = visibilityFromNetworkCache) {
  if (!searchTerms) {
    throw new Error("Parameter searchTerms is required to ensure no DID-based search parameter gives data to someone without visibility.")
  }
  if (inputData?.data) {
    throw new Error("With an embedded 'data' key in the result, you probably intended to use hideDidsAndAddLinksToNetworkInDataKey instead.")
  }

  const validsearchTerms = searchTerms.filter(R.identity) // exclude any undefined/null/empty
  // one lookup for the whole result, so a remote lookup is one round trip
  const visibility = await lookupVisibility(requesterDid, allDidsInside(inputData))
  const visibleDids = new Set(visibility.visibleDids)
  let result
  if (Array.isArray(inputData)) {
    result = []
    for (let item of inputData) {
      if (inputContainsDid(item, requesterDid)) {
        // allow all visibility for those contained in the claim
        result = R.append(item, result)
      } else {
        const oneResult = hideDidsWithVisibility(visibility, item)

        // the nonce is only directly accessible by those who can see the issuer
        if (oneResult && !visibleDids.has(item?.issuer || item?.issuerDid)) {
          delete oneResult["hashNonce"]
        }

        // Only include any item where the result still includes the search term after hiding DIDs
        // because we shouldn't allow someone to search for a DID (or parts) and get activity that's hidden.
        // (Other criteria are OK for searches for non-personal information, just not DID material.)

        // Check that ALL terms they searched for are still included after hiding DIDs
        let allMatch = R.all((term) => JSON.stringify(oneResult).includes(term), validsearchTerms)
        if (allMatch) {
          result = R.append(oneResult, result)
        } else {
          // don't include it, because some search terms ended up being hidden
        }
      }
    }
  } else {
    if (inputContainsDid(inputData, requesterDid)) {
      result = inputData
    } else {
      result = hideDidsWithVisibility(visibility, inputData)
      // the nonce is only directly accessible by those who can see the issuer
      if (result && !visibleDids.has(inputData?.issuer || inputData?.issuerDid)) {
        delete result["hashNonce"]
      }
    }
  }

  // Include any public URLs.
  // For arrays, this adds the publicUrls as a top-level key, which is weird... it works, but we should handle this better.
  let publicUrls = gatherPublicUrls(visibility.publicUrls, result)
  if (R.length(R.keys(publicUrls)) > 0) {
    result["publicUrls"] = publicUrls
  }
  //l.trace(result, "Final API result")

  return result
}

// @param visibility {DidVisibility} for every DID in the input
// @param input {any} the result to be scrubbed
// @returns {any} the result with DIDs hidden, key + "VisibleToDids" added,
function hideDidsWithVisibility(visibility, input) {
  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)) {
      if (visibility.visibleDids.includes(input)) {
        return input
      } else {
        return HIDDEN_TEXT
      }
    } else {
      return input
    }
  } else if (input instanceof Object) {

    const linksTo = (did) => visibility.visibleToDids[did] ?? []
    const nestedValues = R.map(value => hideDidsWithVisibility(visibility, value))(input)

    let result = {}
    if (!Array.isArray(input)) {
      // it's an object
      for (let key of R.keys(input)) {
        result[key] = nestedValues[key]
      }
      // now look for links to any hidden DIDs
      const keys = R.keys(input)
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i]
        let canSee = []
        if (result[key] === HIDDEN_TEXT) {
          // add to list of anyone else who can see them
          canSee = linksTo(input[key])
        } else if (Array.isArray(result[key])) {
          // add to list of anyone else who can see them
          for (let i = 0; i < result[key].length; i++) {
            if (result[key][i] === HIDDEN_TEXT) {
              canSee = R.uniq(R.concat(canSee, linksTo(input[key][i])))
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
      result = nestedValues
    }
    return result
  } else {
    return input
  }
}

// make a map of {DID:URL} for every embedded public DID
// @param urls {object} map from each public DID to its URL
function gatherPublicUrls(urls, input) {
  if (Object.prototype.toString.call(input) === "[object String]") {
    if (isDid(input)
        && urls[input] !== undefined) {
      var result = {}
      result[input] = urls[input]
      return result
    } else {
      return null
    }
  } else if (input instanceof Object) {

    // nestedValues will be an object map or array
    var nestedValues = R.map(value => gatherPublicUrls(urls, value))(input)

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

async function makeGloballyVisible(issuerDid, url, jwt) {
  return addCanSee("*", issuerDid, url, jwt)
    .catch(err => {
      l.error(err, "Got error creating issuer-visible network record for " + issuerDid)
      return Promise.reject("Got error creating issuer-visible network record for " + issuerDid)
    })
}

module.exports = { hideDidsAndAddLinksToNetwork, hideDidsAndAddLinksToNetworkInDataKey, hideDidsWithVisibility /* for tests */, getPublicDidUrl, makeGloballyVisible, takePublicUrls, visibilityFromNetworkCache }
