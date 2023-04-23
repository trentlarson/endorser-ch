import NodeCache from 'node-cache'
import R from 'ramda'

// For pair of ID 1 + ID 2, the array of contact hashes sent
const ContactsSentCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID1+ID2 or ID2+ID1 (in alphabetic order), the matching contacts
const ContactMatchCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID 1 + ID 2, true iff the other party wants to clear the cache
const ContactInfoEraseCache = new NodeCache({ stdTTL: 2 * 60 })

export const RESULT_NEED_DATA = 'NEED_SOURCE_DATA_SETS'
export const RESULT_NEED_APPROVAL = 'NEED_COUNTERPARTY_APPROVAL'

/**
 *
 * @param user1
 * @param user2
 * @returns key that is the same even if arguments are switched
 */
function getMatchKey(user1, user2) {
  return user1 < user2 ? user1 + user2 : user2 + user1
}

function wrapMatches(matches) {
  return { data: { matches: matches } }
}

/**
 *
 * @param user1 current user
 * @param user2 counterparty user who we're checking against
 * @param contactHashes array of encoded hashes to compare

 If counterparty has sent their list, matching contacts are returned:
   `{ data: { matches: ['...', '...', ...] } }` (where matches may be an empty array)
 If counterparty hasn't sent their list, the list will be saved for later
 retrieval and this is returned:
   `{ data: 'NEED_COUNTERPARTY_DATA' }`

 In other words, these results in a { data: ... } value have these meanings:
 - { match: ["..."] }: this are the matches
 - 'NEED_COUNTERPARTY_DATA': the counterparty hasn't sent a match, so this data is stored

 */
export function cacheContactList(user1, user2, user1ContactHashes) {
  const contactHashes = user1ContactHashes || []

  /**
   * Note that there are many ways to implement this and there are many
   * pitfalls, such as not allowing renewal of a user's list, or not allowing
   * renewal until cache timeout, or allowing users to get different matches
   * if one quickly sends different lists. Be careful.
   */

  const matchKey = getMatchKey(user1, user2)
  const myCheckKeyPair = user1 + user2
  if (ContactMatchCache.get(matchKey)) {
    // the match has already been found, so just return that
    return { error: { message: 'Match was already found. Use retrieval endpoint.' } }
  } else if (ContactsSentCache.get(myCheckKeyPair)) {
    return { error: { message: 'You already sent a set of data. To erase, use "clear" endpoint.' } }
  }

  const otherCheckKeyPair = user2 + user1

  const otherList = ContactsSentCache.get(otherCheckKeyPair)
  if (otherList) {
    const overlap = R.intersection(contactHashes, otherList)

    // This is for a single, random match.
    //const index = Math.floor(Math.random() * overlap.length)
    //const match = overlap.length ? overlap[index] : null

    ContactMatchCache.set(matchKey, overlap)
    ContactsSentCache.del(myCheckKeyPair)
    ContactsSentCache.del(otherCheckKeyPair)
    return wrapMatches(overlap)
  } else {
    // the counterparty hasn't sent a list yet, so store this one
    ContactsSentCache.set(myCheckKeyPair, contactHashes)
    return { data: RESULT_NEED_DATA }
  }
}

/**
 * @param user1
 * @param user2
 * @returns {data: {matches: ['....']}} with matches
 * or {data: 'NEED_COUNTERPARTY_DATA'} if there is no match yet
 */
export function getContactMatch(user1, user2) {
  const result = ContactMatchCache.get(getMatchKey(user1, user2))
  if (result === undefined) {
    return { data: RESULT_NEED_DATA }
  } else {
    return wrapMatches(result)
  }
}

/**
 * @param user1
 * @param user2
 * @returns
 * { success: true } if this request triggered clearing the caches
 *   (which is the side-effect of this function)
 * otherwise, returns { success: 'NEED_COUNTERPARTY_APPROVAL' }
 */
export function clearContactCaches(user1, user2) {
  const myCheckKeyPair = user1 + user2
  const otherCheckKeyPair = user2 + user1
  const matchKey = getMatchKey(user1, user2)
  if (ContactInfoEraseCache.get(otherCheckKeyPair)) {
    // the other party has already requested to clear the cache
    ContactsSentCache.del(myCheckKeyPair)
    ContactsSentCache.del(otherCheckKeyPair)
    ContactMatchCache.del(matchKey)
    ContactInfoEraseCache.del(myCheckKeyPair)
    ContactInfoEraseCache.del(otherCheckKeyPair)
    return { success: true }
  } else {
    // the other party hasn't requested to clear the cache
    ContactInfoEraseCache.set(myCheckKeyPair, true)
    return { success: RESULT_NEED_APPROVAL }
  }
}
