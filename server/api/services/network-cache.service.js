import db from './endorser.db.service'
import { hideDids } from './util'
import NodeCache from 'node-cache'

// I expect this is a singleton.
const NetworkCache = new NodeCache()

async function hideDidsForUser(requesterDid, result) {
  var allowedDids = NetworkCache.get(requesterDid)
  if (!allowedDids) {
    allowedDids = await db.getNetwork(requesterDid)
    NetworkCache.set(requesterDid, allowedDids)
  }
  return hideDids(allowedDids, result)
}

module.exports = { hideDidsForUser }
