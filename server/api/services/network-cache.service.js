import NodeCache from 'node-cache'
import R from 'ramda'

import db from './endorser.db.service'
import { hideDids } from './util'
import l from '../../common/logger'

// I expect this is a singleton.
const NetworkCache = new NodeCache()

async function hideDidsForUser(requesterDid, result) {
  var allowedDids = NetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await db.getNetwork(requesterDid)
    l.trace(`Here are the currently allowedDids from DB for requester ${requesterDid}`)
    l.trace(JSON.stringify(allowedDids)) // because empty arrays would show as nothing (ug1)
    NetworkCache.set(requesterDid, allowedDids)
  }
  return hideDids(allowedDids, result)
}

async function addDidSeenByUser(subject, object) {
  db.networkInsert(subject, object)

  var allowedDids = NetworkCache.get(subject)
  if (!allowedDids) {
    allowedDids = []
  }
  NetworkCache.set(subject, R.concat(allowedDids, [object]))
}

module.exports = { addDidSeenByUser, hideDidsForUser }
