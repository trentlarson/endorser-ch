import NodeCache from 'node-cache'
import R from 'ramda'

import db from './endorser.db.service'

import l from '../../common/logger'

/**
   For each subject, what are the object DIDs they can see?
**/
const SeesInNetworkCache = new NodeCache()

async function getSeenByAll() {
  var seenByAll = SeesInNetworkCache.get(db.ALL_SUBJECT_MATCH())
  if (!seenByAll) {
    seenByAll = await db.getSeenByAll()
    l.trace(`Here are the currently allowed DIDs from DB who everyone can see: ` + JSON.stringify(seenByAll)) // because empty arrays show as nothing (ug!)
    SeesInNetworkCache.set(db.ALL_SUBJECT_MATCH(), seenByAll)
  }
  return seenByAll
}

async function getDidsRequesterCanSeeExplicitly(requesterDid) {
  var allowedDids = SeesInNetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await db.getSeesNetwork(requesterDid)
    l.trace(`Here are the currently allowed DIDs from DB who ${requesterDid} can see: ` + JSON.stringify(allowedDids))
    SeesInNetworkCache.set(requesterDid, allowedDids)
  }
  return allowedDids
}

/**
   return every DID that requester (subject) can see
**/
async function getAllDidsRequesterCanSee(requesterDid) {
  let didsCanSee = await getDidsRequesterCanSeeExplicitly(requesterDid)
  var result = didsCanSee.concat(await getSeenByAll())
  var result2 = result.concat([requesterDid]) // themself
  return result2
}




/**
   For each object, what are the subject DIDs who can see them?
**/
const SeenByNetworkCache = new NodeCache()

async function getDidsWhoCanSeeExplicitly(object) {
  var allowedDids = SeenByNetworkCache.get(object)
  if (!allowedDids) {
    allowedDids = await db.getSeenByNetwork(object)
    l.trace(`Here are the currently allowed DIDs from DB who ${object} can see: ` + JSON.stringify(allowedDids))
    SeenByNetworkCache.set(object, allowedDids)
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
   add subject/object combo to DB and caches
**/
async function addCanSee(subject, object) {

  if (subject.startsWith("did:none:")) {
    // No need to continue with this, since nobody can make a valid submission with this DID method.
    // This often happens for HIDDEN, when people are confirming without looking.
    return
  }

  if (subject !== object) {
    // no need to save themselves in the DB (heck: we could do without the caching, too, but it's fast, so whatever)
    db.networkInsert(subject, object)
  }

  var seesDids = SeesInNetworkCache.get(subject)
  if (!seesDids) {
    seesDids = []
  }
  if (R.indexOf(object, seesDids) == -1) {
    let newList = R.concat(seesDids, [object])
    SeesInNetworkCache.set(subject, newList)
  }

  var seenByDids = SeenByNetworkCache.get(object)
  if (!seenByDids) {
    seenByDids = []
  }
  if (R.indexOf(subject, seenByDids) == -1) {
    let newList = R.concat(seenByDids, [subject])
    SeenByNetworkCache.set(object, newList)
  }
}

/**
  Takes an initial subject and who they'd like to see
  and returns all the DIDs who are seen by subject and who can see finalObject.
  Note that this does not check for anyone who is seen by all; it assumes that has already been checked.
 **/
async function whoDoesRequestorSeeWhoCanSeeObject(requesterDid, object) {
  var seesList = await getAllDidsRequesterCanSee(requesterDid)
  // Don't need to check for object as target of ALL_SUBJECT_MATCH because they'd already be visible to requestor if so.
  var seenByList = await getDidsWhoCanSeeExplicitly(object)
  return R.intersection(seesList, seenByList)
}

module.exports = { addCanSee, getAllDidsRequesterCanSee, whoDoesRequestorSeeWhoCanSeeObject }
