import NodeCache from 'node-cache'
import R from 'ramda'

// For pair of ID 1 + ID 2, the array of contact hashes sent
const ContactsSharedCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID1+ID2 or ID2+ID1 (alphabetic order), the matching contact
const ContactMatchCache = new NodeCache({ stdTTL: 2 * 60 })

export const RESULT_NEED_DATA = 'NEED_COUNTERPARTY_DATA'
export const RESULT_NO_MATCH = 'NO_MATCH'

/**
 *
 * @param user1
 * @param user2
 * @returns key that is the same even if arguments are switched
 */
function getMatchKeyPair(user1, user2) {
  return user1 < user2 ? user1 + user2 : user2 + user1
}

function wrapResult(result) {
  if (result === undefined) {
    return { data: RESULT_NEED_DATA() }
  } else if (result === null) {
    return { data: RESULT_NO_MATCH }
  } else {
    return { data: { match: result } }
  }
}

/**
 *
 * @param user1 current user
 * @param user2 counterparty user who we're checking against
 * @param contactHashes array of encoded hashes to compare

 If counterparty has sent their list:
 - if there was a match, a randomly-selected matching contact is returned:
   { data: { match: '...' } }
 - if there was no match, null is returned:
   { data: 'NO_MATCH' }
 If counterparty hasn't sent their list, the list will be saved for later
 retrieval and this is returned:
   { data: 'NEED_COUNTERPARTY_DATA' }

 In other words, these results in a { data: ... } value have these meanings:
 - { match: "..." }: this is the match chosen
 - 'NO_MATCH': no match was found between the two lists
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

  // erase previous list by this user
  const myCheckKeyPair = user1 + user2
  ContactsSharedCache.del(myCheckKeyPair)

  const otherCheckKeyPair = user2 + user1
  // erase previous list by the other user
  const otherList = ContactsSharedCache.take(otherCheckKeyPair)
  if (otherList) {
    // obviously this will overwrite any match
    const overlap = R.intersection(contactHashes, otherList)
    const index = Math.floor(Math.random() * overlap.length)
    const match = overlap.length ? overlap[index] : null
    ContactMatchCache.set(getMatchKeyPair(user1, user2), match)
    if (match == null) {
      return { data: RESULT_NO_MATCH }
    } else {
      return { data: { match: match } }
    }
  }

  // the counterparty doesn't have a list so store this one
  ContactsSharedCache.set(myCheckKeyPair, contactHashes || [])
  return { data: RESULT_NEED_DATA }
}

/**
 * @param user1
 * @param user2
 * @returns the match (string) or null (if there is no match) or nothing
 *   (if there weren't two lists sent earlier)
 */
export function getContactMatch(user1, user2) {
  const result = ContactMatchCache.get(getMatchKeyPair(user1, user2))
  if (result === undefined) {
    return { data: RESULT_NEED_DATA }
  } else if (result === null) {
    return { data: RESULT_NO_MATCH }
  } else {
    return { data: { match: result } }
  }
}
