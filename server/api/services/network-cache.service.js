import NodeCache from 'node-cache'
import R from 'ramda'

import db from './endorser.db.service'

import l from '../../common/logger'

// I expect this is a singleton.
const SeesInNetworkCache = new NodeCache()
const SeenByNetworkCache = new NodeCache()

async function getSeesDids(requesterDid) {
  var allowedDids = SeesInNetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await db.getSeesNetwork(requesterDid)
    l.trace(`Here are the currently allowed DIDs from DB who ${requesterDid} can see: ` + JSON.stringify(allowedDids))
    l.trace() // because empty arrays would show as nothing (ug1)
    SeesInNetworkCache.set(requesterDid, allowedDids)
  }
  return allowedDids
}

async function getSeenByDids(object) {
  var allowedDids = SeenByNetworkCache.get(object)
  if (!allowedDids) {
    allowedDids = await db.getSeenByNetwork(object)
    l.trace(`Here are the currently allowed DIDs from DB who ${object} can see: ` + JSON.stringify(allowedDids))
    SeenByNetworkCache.set(object, allowedDids)
  }
  return allowedDids
}

/**
   add user to DB and caches
**/
async function addCanSee(subject, object) {
  db.networkInsert(subject, object)

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
  and returns all the DIDs who are seen by subject and who can see finalObject
 **/
async function seesObjectThroughOthers(requesterDid, finalObject) {
  var seesList = await getSeesDids(requesterDid)
  var seenByList = await getSeenByDids(finalObject)
  return R.intersection(seesList, seenByList)
}

module.exports = { addCanSee, getSeesDids, seesObjectThroughOthers }
