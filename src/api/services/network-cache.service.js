import NodeCache from 'node-cache'
import R from 'ramda'

import { dbService } from './endorser.db.service'

import l from '../../common/logger'

const BLANK_URL = ""

/**
  URL for each public DID, as an key-value map (... so let's hope there are never too many!)
  These are inserted every time a public DID is requested from the DB.
**/
var UrlsForPublicDids = {}

// return a URL or BLANK_URL if it's a public URL, otherwise return 'undefined'
function getPublicDidUrl(did) {
  return UrlsForPublicDids[did]
}

/**
   For each subject, what are the object DIDs they can see?
**/
const SeesNetworkCache = new NodeCache({ stdTTL: 60 * 60 })

async function getDidsRequesterCanSeeExplicitly(requesterDid) {
  if (!requesterDid) return []
  var allowedDids = SeesNetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await dbService.getSeenBy(requesterDid)
    l.trace(`Here are the currently allowed DIDs from DB who ${requesterDid} can see: ` + JSON.stringify(allowedDids)) // using stringify because empty arrays show as nothing (ug!)
    SeesNetworkCache.set(requesterDid, allowedDids)
  }
  return allowedDids
}

async function getDidsSeenByAll() {
  let requesterDid = dbService.ALL_SUBJECT_MATCH()
  var allowedDids = SeesNetworkCache.get(requesterDid)
  if (!allowedDids) {
    var allowedDidsAndUrls = await dbService.getSeenByAll()

    // set all the public URLs we see
    UrlsForPublicDids = {}
    R.map((r) => { UrlsForPublicDids[r.did] = r.url ? r.url : BLANK_URL })(allowedDidsAndUrls)

    allowedDids = R.map((r) => r.did)(allowedDidsAndUrls)

    l.trace(`Here are the currently allowed DIDs & URLs from DB who everyone can see: ` + JSON.stringify(allowedDidsAndUrls)) // using stringify because empty arrays show as nothing (ug!)
    SeesNetworkCache.set(requesterDid, allowedDids)
  }
  return allowedDids
}

/**
   return every DID that requester (subject) can see
**/
async function getAllDidsRequesterCanSee(requesterDid) {
  let didsCanSee = await getDidsRequesterCanSeeExplicitly(requesterDid)
  let result = didsCanSee.concat(await getDidsSeenByAll())
  let result2 = result.concat([requesterDid]) // themselves
  return R.uniq(result2)
}

// for each did, return that DID if it's visible to requester, otherwise return the list of DIDs who can see that DID (maybe empty)
// [ didOrList: string | string[], ... ]
async function getAllDidsBetweenRequesterAndObjects(requesterDid, dids) {
  const didsRequesterCanSee = await getAllDidsRequesterCanSee(requesterDid)
  const didsWhoCanSeeObjects = await Promise.all(dids.map(object =>
    didsRequesterCanSee.includes(object)
    ? object
    : whoDoesRequesterSeeWhoCanSeeObject(requesterDid, object)
  ))
  return didsWhoCanSeeObjects
}


/**
   For each object, what are the subject DIDs who can see them?
**/
const WhoCanSeeNetworkCache = new NodeCache({ stdTTL: 60 * 60 })

async function getDidsWhoCanSeeExplicitly(object) {
  if (!object) return []
  var allowedDids = WhoCanSeeNetworkCache.get(object)
  if (!allowedDids) {
    allowedDids = await dbService.getWhoCanSee(object)
    l.trace(`Here are the currently allowed DIDs from DB who can see ${object}: ` + JSON.stringify(allowedDids)) // using stringify because empty arrays show as nothing (ug!)
    WhoCanSeeNetworkCache.set(object, allowedDids)
  }
  return allowedDids
}

async function canSeeExplicitly(subject, object) {
  const canSee = await getDidsWhoCanSeeExplicitly(object)
  const result = R.includes(subject, canSee)
  return result
}

/**
   return either [dbService.ALL_SUBJECT_MATCH()] or the list of DIDs who can explicitly see object (excluding dbService.ALL_SUBJECT_MATCH())
**/
/** unused
async function getAllDidsWhoCanSeeObject(object) {
  let allowedDids = getDidsWhoCanSeeExplicitly(object)
  if (allowedDids.indexOf(dbService.ALL_SUBJECT_MATCH()) > -1) {
    return [dbService.ALL_SUBJECT_MATCH()]
  } else {
    return allowedDids
  }
}
**/



/**
   add subject-can-see-object relationship to DB and caches
**/
async function addCanSee(subject, object, url, jwt) {

  if (!subject
      || subject.startsWith("did:none:")
      || !object
      || object.startsWith("did:none:")) {
    // No need to continue with this, since nobody can make a valid request with this DID method.
    // This often happens for HIDDEN, when people are confirming without looking.
    l.trace(`Not adding a network entry since a DID is empty or has DID method 'none': ${subject} ${object}`)
    return false
  }

  if (subject !== object) {
    await dbService.networkInsert(subject, object, url, jwt)
  } else {
    // no need to save themselves in the DB
    l.trace("Not adding DB network entry since it's the same DID.")
    return false
  }

  if (subject === dbService.ALL_SUBJECT_MATCH()) {
    UrlsForPublicDids[object] = (url ? url : BLANK_URL)
  }
  // else it has to be fully initialized from the DB before next read anyway




  // Similar code is in removeCanSee

  // The remainder sets the internal cache by adding that one subject-object pair,
  // but it really should just invalidate and reload from the DB.

  let seesDids = await getDidsRequesterCanSeeExplicitly(subject)
  if (!seesDids) {
    seesDids = []
  }
  if (R.indexOf(object, seesDids) == -1) {
    let newList = R.concat(seesDids, [object])
    const setResult = SeesNetworkCache.set(subject, newList)
    if (!setResult) {
      l.error('Failed to set SeesNetworkCache for key', subject, 'and value', newList)
    }
  }
  // l.trace("Now", subject, "sees", getDidsRequesterCanSeeExplicitly(subject))

  let seenByDids = await getDidsWhoCanSeeExplicitly(object)
  if (!seenByDids) {
    seenByDids = []
  }
  if (R.indexOf(subject, seenByDids) == -1) {
    let newList = R.concat(seenByDids, [subject])
    const setResult = WhoCanSeeNetworkCache.set(object, newList)
    if (!setResult) {
      l.error('Failed to set WhoCanSeeNetworkCache for key', object, 'and value', newList)
    }
  }
  // l.trace("Now", object, "is seen by", getDidsWhoCanSeeExplicitly(object))

  return true
}

/**
   remove subject-can-see-object relationship to DB and caches
**/
async function removeCanSee(subject, object) {

  if (!subject
      || subject.startsWith("did:none:")
      || !object
      || object.startsWith("did:none:")) {
    // No need to continue with this, since nobody can make a valid request with this DID method.
    l.trace(`Not removing a network entry since a DID is empty or has DID method 'none': ${subject} ${object}`)
    return false
  }

  if (subject !== object) {
    await dbService.networkDelete(subject, object)
  } else {
    // we don't save themselves in the DB anyway
    l.trace("Not removing DB network entry since it's the same DID.")
    return false
  }

  if (subject === dbService.ALL_SUBJECT_MATCH()) {
    UrlsForPublicDids = R.omit([object], UrlsForPublicDids)
  }
  // else it has to be fully initialized from the DBSERVICE before next read anyway




  // Similar code is in addCanSee

  // The remainder sets the internal cache by removing that one subject-object pair,
  // but it really should just invalidate and reload from the DB.

  let seesDids = await getDidsRequesterCanSeeExplicitly(subject)
  if (!seesDids) {
    seesDids = []
  }
  const objectIndex = R.indexOf(object, seesDids)
  if (objectIndex > -1) {
    let newList = R.remove(objectIndex, 1, seesDids)
    const setResult = SeesNetworkCache.set(subject, newList)
    if (!setResult) {
      l.error('Failed to set SeesNetworkCache for key', subject, 'and value', newList)
    }
  }
  l.trace("Now", subject, "sees", getDidsRequesterCanSeeExplicitly(subject))

  let seenByDids = await getDidsWhoCanSeeExplicitly(object)
  if (!seenByDids) {
    seenByDids = []
  }
  const subjectIndex = R.indexOf(subject, seenByDids)
  if (subjectIndex > -1) {
    let newList = R.remove(subjectIndex, 1, seenByDids)
    const setResult = WhoCanSeeNetworkCache.set(object, newList)
    if (!setResult) {
      l.error('Failed to set WhoCanSeeNetworkCache for key', object, 'and value', newList)
    }
  }
  l.trace("Now", object, "is seen by", getDidsWhoCanSeeExplicitly(object))

  return true
}

/**
  Takes an initial subject and who they'd like to see
  and returns array of all the DIDs who are seen by subject and who can see finalObject.
  Note that this does not check for anyone who is seen by all; it assumes that has already been checked.
 **/
async function whoDoesRequesterSeeWhoCanSeeObject(requesterDid, object) {
  var seesList = await getAllDidsRequesterCanSee(requesterDid)
  // Don't need to check for object as target of ALL_SUBJECT_MATCH because they'd already be visible to requester if so.
  var seenByList = await getDidsWhoCanSeeExplicitly(object)
  return R.intersection(seesList, seenByList)
}

module.exports = { addCanSee, canSeeExplicitly, getAllDidsBetweenRequesterAndObjects, getAllDidsRequesterCanSee, getPublicDidUrl, getDidsSeenByAll, removeCanSee, whoDoesRequesterSeeWhoCanSeeObject }
