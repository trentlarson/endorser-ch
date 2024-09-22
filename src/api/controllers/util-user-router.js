import * as express from 'express'
import {
  cacheContactList,
  clearContactCaches,
  getContactMatch,
} from "../services/contact-correlation.service";
import { dbService } from '../services/endorser.db.service'

export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
  })

/**
 * See /server/common/server.js for other Swagger settings & pieces of generated docs.
 **/

/**
 * Update the contact lookup cache for this user & their counterparty
 *
 * @group user utils - User Utils
 * @route POST /api/userUtil/cacheContactList
 * @param {string} counterparty.query.required - the other party with whom to compare (also acceptable in the body)
 * @param {Array<string>} contactHashes.body.required
 * @param {boolean} onlyOneMatch.body.optional - if true, only return the first match
 * @returns 201 -
 *
 *  If counterparty has sent their list, matching contacts are returned:
 *    `{ data: { matches: ['...', '...', ...] } }` (where matches may be an empty array)
 *  If counterparty hasn't sent their list, the list will be saved for later
 *  retrieval and this is returned:
 *    `{ data: 'NEED_COUNTERPARTY_DATA' }`
 *
 *  In other words, the following results in a { data: ... } value have these meanings:
 *    * { matches: ["..."] }: this are the matches
 *    * 'NEED_COUNTERPARTY_DATA': the counterparty hasn't sent a match, so this data is stored
 *
 *  If there is an error, the result is: { error: { message: '...' } }
 *
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post(
    '/cacheContactList',
    async (req, res) => {
      const limits = await dbService.registrationByDid(res.locals.tokenIssuer)
      if (!limits) {
        res.status(400).json({ error: { message: 'You are not registered for this service.' } }).end()
        return
      }
      const counterpartyId = req.query.counterparty || req.body.counterparty
      const result =
        cacheContactList(
          res.locals.tokenIssuer, counterpartyId,
          req.body.contactHashes, req.body.onlyOneMatch
        )
      if (result.error) {
        res.status(400).json(result).end()
      } else {
        res.status(201).json(result).end()
      }
    }
  )

/**
 * Retrieve the matching contacts for this user & their counterparty
 *
 * @group user utils - User Utils
 * @route GET /api/userUtil/getContactMatch
 * @param {string} counterparty.query.required - the other party with whom to compare
 * @returns 200 -
 * matches as: {data: {matches: ['....']}}
 * or, since there are no matches: {data: CODE}
 * ... where CODE is one of:
 *   * 'NEED_BOTH_USER_DATA'
 *   * 'NEED_THIS_USER_DATA'
 *   * 'NEED_COUNTERPARTY_DATA'
 *
 * Also: note that data.onlyOneMatch will be true if we only returned one of the matches chosen at random.
 *
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get(
    '/getContactMatch',
    async (req, res) => {
      const limits = await dbService.registrationByDid(res.locals.tokenIssuer)
      if (!limits) {
        res.status(400).json({ error: { message: 'You are not registered for this service.' } }).end()
        return
      }
      const result = getContactMatch(res.locals.tokenIssuer, req.query.counterparty)
      res.status(200).json(result).end()
    }
  )

/**
 * Ask to clear out the contact caches
 *
 * @group user utils - User Utils
 * @route DELETE /api/userUtil/clearContactCaches
 * @param {string} counterparty.query.required - the other party with whom to compare (also acceptable in the body)
 * @returns 200 -
 * { success: CODE } if this request triggered clearing the caches
 * (which is the side&ndash;effect of this function)
 * ... where CODE is one of:
 *   * 'ALL_CACHES_CLEARED' to mean all caches were cleared
 *   * 'ONE_CACHE_CLEARED' to mean only this user's cache was cleared
 *
 * ... otherwise, returns { success: 'NEED_COUNTERPARTY_APPROVAL' }
 * to note that this request has been recorded but we need the other party to approve
 *
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .delete(
    '/clearContactCaches',
    async (req, res) => {
      const limits = await dbService.registrationByDid(res.locals.tokenIssuer)
      if (!limits) {
        res.status(400).json({ error: { message: 'You are not registered for this service.' } }).end()
        return
      }
      const counterpartyId = req.query.counterparty || req.body.counterparty
      const result = clearContactCaches(res.locals.tokenIssuer, counterpartyId)
      res.status(200).json(result).end()
    }
  )
