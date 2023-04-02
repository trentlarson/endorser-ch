import NodeCache from 'node-cache'
import R from 'ramda'

// For pair of ID 1 + ID 2, the array of contact hashes sent
const ContactsSharedCache = new NodeCache({ stdTTL: 2 * 60 })
// For pair of ID1+ID2 or ID2+ID1 (alphabetic order), the matching contact
const ContactMatchCache = new NodeCache({ stdTTL: 2 * 60 })

/**
 *
 * @param user1
 * @param user2
 * @returns key that is the same even if arguments are switched
 */
function getMatchKeyPair(user1, user2) {
  return user1 < user2 ? user1 + user2 : user2 + user1
}

/**
 *
 * @param user1 current user
 * @param user2 counterparty user who we're checking against
 * @param contactHashes array of encoded hashes to compare

 If counterparty has sent their list:
 - if there was a match, a randomly-selected matching contact is returned
 - if there was no match, null is returned
 If counterparty hasn't sent their list, the list will be saved for later
 retrieval and no result is returned.

 In other words, these result types have these meanings:
 - string: this is the match chosen
 - null: no match was found between the two lists
 - undefined: the counterparty hasn't sent a match, so this data is stored

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
    return match
  }

  // the counterparty doesn't have a list so store this one
  ContactsSharedCache.set(myCheckKeyPair, contactHashes || [])
}

/**
 * @param user1
 * @param user2
 * @returns the match (string) or null (if there is no match) or nothing
 *   (if there weren't two lists sent earlier)
 */
export function getContactMatch(user1, user2) {
  return ContactMatchCache.get(getMatchKeyPair(user1, user2))
}
