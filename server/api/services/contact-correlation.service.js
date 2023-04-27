import NodeCache from 'node-cache'
import R from 'ramda'

// For pair of ID 1 + ID 2, true iff the other party wants to clear the cache
const ContactInfoEraseCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID1+ID2 or ID2+ID1 (in alphabetic order), the matching contacts
const ContactMatchCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID 1 + ID 2, the array of contact hashes sent
const ContactsSentCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID1+ID2 or ID2+ID1 (in alphabetic order), true iff a user requested a single randomized match
const UserRequestedSingleMatch = new NodeCache({ stdTTL: 2 * 60 })

export const RESULT_ALL_CLEARED = 'ALL_CACHES_CLEARED'
export const RESULT_NEED_APPROVAL = 'NEED_COUNTERPARTY_APPROVAL'
export const RESULT_NEED_COUNTERPARTY_DATA = 'NEED_COUNTERPARTY_DATA'
export const RESULT_NEED_DATA = 'NEED_DATA'
export const RESULT_ONE_CLEARED = 'ONE_CACHE_CLEARED'

/**
 *
 * @param user1
 * @param user2
 * @returns key that is the same even if arguments are switched
 */
function getMatchKey(user1, user2) {
  return user1 < user2 ? user1 + user2 : user2 + user1
}

function wrapMatches(matches, matchKey) {
  const result = { data: { matches: matches } }
  if (UserRequestedSingleMatch.get(matchKey)) {
    result.data.onlyOneMatch = true
  }
  return result
}

/**
 *
 * @param user1 current user
 * @param user2 counterparty user who we're checking against
 * @param user1ContactHashes array of encoded hashes to compare
 * @param onlyOneMatch if true, only return one randomized match
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
export function cacheContactList(user1, user2, user1ContactHashes, onlyOneMatch) {
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
    return { error: { message: 'Data was already sent. To see the results, use the retrieval function.' } }
  } else if (ContactsSentCache.get(myCheckKeyPair)) {
    return { error: { message: 'You already sent a set of data. To erase it, use the "clear" function.' } }
  }

  if (onlyOneMatch && !UserRequestedSingleMatch.get(matchKey)) {
    UserRequestedSingleMatch.set(matchKey, onlyOneMatch)
  }

  const otherCheckKeyPair = user2 + user1
  const otherList = ContactsSentCache.get(otherCheckKeyPair)
  if (otherList) {
    let overlap = R.intersection(contactHashes, otherList)

    if (overlap.length > 0 && UserRequestedSingleMatch.get(matchKey)) {
      const index = Math.floor(Math.random() * overlap.length)
      overlap = [overlap[index]]
    }

    ContactMatchCache.set(matchKey, overlap)
    ContactsSentCache.del(myCheckKeyPair)
    ContactsSentCache.del(otherCheckKeyPair)
    return wrapMatches(overlap, matchKey)
  } else {
    // the counterparty hasn't sent a list yet, so store this one
    ContactsSentCache.set(myCheckKeyPair, contactHashes)
    return { data: RESULT_NEED_COUNTERPARTY_DATA }
  }
}

/**
 * @param user1
 * @param user2
 * @returns {data: {matches: ['....']}} with matches
 * or {data: 'NEED_DATA'} if there is no match yet
 */
export function getContactMatch(user1, user2) {
  const matchKey = getMatchKey(user1, user2)
  const result = ContactMatchCache.get(matchKey)
  if (result === undefined) {
    return { data: RESULT_NEED_DATA }
  } else {
    return wrapMatches(result, matchKey)
  }
}

/**
 * Need this in case there are no matches, so the users can start over.
 * But it has to be agreed so that one cannot see results and clear to hide them.
 *
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
    ContactInfoEraseCache.del(myCheckKeyPair)
    ContactInfoEraseCache.del(otherCheckKeyPair)
    ContactMatchCache.del(matchKey)
    ContactsSentCache.del(myCheckKeyPair)
    ContactsSentCache.del(otherCheckKeyPair)
    UserRequestedSingleMatch.del(matchKey)
    return {success: RESULT_ALL_CLEARED}
  } else if (!ContactMatchCache.get(matchKey)
             && !ContactsSentCache.get(myCheckKeyPair)) {
    // the other party hasn't sent a list yet, so just clear the cache
    ContactInfoEraseCache.del(myCheckKeyPair)
    ContactsSentCache.del(myCheckKeyPair)
    return { success: RESULT_ONE_CLEARED }
  } else {
    // the other party hasn't requested to clear the cache
    ContactInfoEraseCache.set(myCheckKeyPair, true)
    return { success: RESULT_NEED_APPROVAL }
  }
}
