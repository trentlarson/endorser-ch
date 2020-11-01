import NodeCache from 'node-cache'
import R from 'ramda'

import db from './endorser.db.service'

import l from '../../common/logger'

const BLANK_URL = ""

/**
  URL for each public DID, as an key-value map (... so let's hope there are never too many!)
  These are inseted every time a public DID is requested from the DB.
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
  var allowedDids = SeesNetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await db.getSeenBy(requesterDid)
    l.trace(`Here are the currently allowed DIDs from DB who ${requesterDid} can see: ` + JSON.stringify(allowedDids)) // using stringify because empty arrays show as nothing (ug!)
    SeesNetworkCache.set(requesterDid, allowedDids)
  }
  return allowedDids
}

async function getDidsSeenByAll() {
  let requesterDid = db.ALL_SUBJECT_MATCH()
  var allowedDids = SeesNetworkCache.get(requesterDid)
  if (!allowedDids) {
    var allowedDidsAndUrls = await db.getSeenByAll()

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
  let result2 = result.concat([requesterDid]) // themself
  return R.uniq(result2)
}




/**
   For each object, what are the subject DIDs who can see them?
**/
const WhoCanSeeNetworkCache = new NodeCache({ stdTTL: 60 * 60 })

async function getDidsWhoCanSeeExplicitly(object) {
  var allowedDids = WhoCanSeeNetworkCache.get(object)
  if (!allowedDids) {
    allowedDids = await db.getWhoCanSee(object)
    l.trace(`Here are the currently allowed DIDs from DB who can see ${object}: ` + JSON.stringify(allowedDids)) // using stringify because empty arrays show as nothing (ug!)
    WhoCanSeeNetworkCache.set(object, allowedDids)
  }
  return allowedDids
}

/**
   return either [db.ALL_SUBJECT_MATCH()] or the list of DIDs who can explicitly see object (excluding db.ALL_SUBJECT_MATCH())
**/
/** unused
async function getAllDidsWhoCanSeeObject(object) {
  let allowedDids = getDidsWhoCanSeeExplicitly(object)
  if (allowedDids.indexOf(db.ALL_SUBJECT_MATCH()) > -1) {
    return [db.ALL_SUBJECT_MATCH()]
  } else {
    return allowedDids
  }
}
**/



/**
   add subject-can-see-object relationship to DB and caches
**/
async function addCanSee(subject, object, url) {

  if (subject.startsWith("did:none:")
      || object.startsWith("did:none:")) {
    // No need to continue with this, since nobody can make a valid submission with this DID method.
    // This often happens for HIDDEN, when people are confirming without looking.
    l.trace(`... but actually not adding a network entry since the DID type is 'none'.`)
    return
  }

  if (subject !== object) {
    await db.networkInsert(subject, object, url)
  } else {
    // no need to save themselves in the DB (heck: we could do without the caching, too, since we always add this person via getAllDidsRequesterCanSee, but it's fast, so whatever)
    l.trace("... but not adding DB network entry since it's the same DID.")
  }

  if (subject === db.ALL_SUBJECT_MATCH()) {
    UrlsForPublicDids[object] = (url ? url : BLANK_URL)
  }
  // else it has to be fully initialized from the DB before next read anyway




  // The remainder sets the internal cache by adding that one subject-object pair,
  // but it really should just invalidate and reload from the DB.

  let seesDids = getDidsRequesterCanSeeExplicitly(subject)
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
  l.info("Now", subject, "sees", getDidsRequesterCanSeeExplicitly(subject))

  let seenByDids = getDidsWhoCanSeeExplicitly(object)
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
  l.info("Now", object, "is seen by", getDidsWhoCanSeeExplicitly(object))
}

/**
  Takes an initial subject and who they'd like to see
  and returns all the DIDs who are seen by subject and who can see finalObject.
  Note that this does not check for anyone who is seen by all; it assumes that has already been checked.
 **/
async function whoDoesRequesterSeeWhoCanSeeObject(requesterDid, object) {
  var seesList = await getAllDidsRequesterCanSee(requesterDid)
  // Don't need to check for object as target of ALL_SUBJECT_MATCH because they'd already be visible to requester if so.
  var seenByList = await getDidsWhoCanSeeExplicitly(object)
  return R.intersection(seesList, seenByList)
}

module.exports = { addCanSee, getAllDidsRequesterCanSee, getPublicDidUrl, getDidsSeenByAll, whoDoesRequesterSeeWhoCanSeeObject }
