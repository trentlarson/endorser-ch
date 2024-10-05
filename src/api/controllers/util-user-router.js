import * as express from 'express'

import {
  cacheContactList,
  clearContactCaches,
  getContactMatch,
} from "../services/contact-correlation.service";
import { dbService } from '../services/endorser.db.service'
import { decodeAndVerifyJwt } from "../services/vc";

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

/**
 * Save info about an invitation so that redemption is recognized.
 * Note that we ask for the invite JWT now for audit purposes.
 * We also still get an authorization JWT separately so that there's an expiration on it.
 *
 * @group user utils - User Utils
 * @route POST /api/userUtil/invite
 * @param {string} inviteJwt.body.required - issuer code to specify invitee, must be 20 characters or more and should be random
 * @param {string} expiresAt.body.optional - ISO 8601 date string for when the invite expires
 * @param {string} notes.body.optional - issuer notes to remember the invitee
 * @returns 200 - the internal ID of the invite with a
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post(
    '/invite',
    async (req, res) => {
      try {
        if (!req.body.inviteJwt) {
          res.status(400).json({ error: { message: 'You must specify an inviteJwt.' } }).end()
          return
        }
        const verifiedInvite = await decodeAndVerifyJwt(req.body.inviteJwt)
        const identifier = verifiedInvite.payload.claim.identifier
        const date = new Date(verifiedInvite.payload.exp).toISOString()
        if (!identifier || identifier.length < 20) {
          res.status(400).json({ error: { message: 'You must specify an identifier of 20+ characters for the invitation, used inside the RegisterAction given to the invitee.' } }).end()
        } else if (!verifiedInvite.payload.exp) {
          res.status(400).json({ error: { message: 'You must specify an expiration date-time for the invitation. Use the same date as the RegisterAction.' } }).end()
        } else {
          await dbService.inviteOneInsert(res.locals.tokenIssuer, identifier, req.body.notes, date, req.body.inviteJwt)
          res.status(200).json({ success: true }).end()
        }
      } catch (error) {
        res.status(500).json({ error: { message: error.message } }).end()
      }
    }
  )

/**
 * Redeem an invite
 *
 * @group user utils - User Utils
 * @route POST /api/userUtil/invite
 * @param {string} notes.body.optional - issuer notes to remember the invitee
 * @returns 200 - the internal ID of the invite with a
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post(
    '/redeemInvite',
    async (req, res) => {
      try {
        const verifiedInvite = await decodeAndVerifyJwt(req.body.inviteJwt)
        console.log("verified", verifiedInvite)
        const identifier = verifiedInvite.payload.claim.identifier
        const date = new Date(verifiedInvite.payload.exp).toISOString()
        if (!identifier || identifier.length < 20) {
          res.status(400).json({ error: { message: 'You must specify an identifier of 20+ characters for the invitation, used inside the RegisterAction given to the invitee.' } }).end()
        } else if (!verifiedInvite.payload.exp) {
          res.status(400).json({ error: { message: 'You must specify an expiration date-time for the invitation. Use the same date as the RegisterAction.' } }).end()
        } else {
          await dbService.inviteOneInsert(res.locals.tokenIssuer, identifier, req.body.notes, date, req.body.inviteJwt)
          res.status(200).json({ success: true }).end()
        }
      } catch (error) {
        res.status(500).json({ error: { message: error.message } }).end()
      }
    }
  )

/**
 * Retrieve invite for this identifier
 *
 * @group user utils - User Utils
 * @route GET /api/userUtil/invite/:identifier
 * @param {string} identifier.query.required - identifier originally sent
 * @returns 200
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get(
    '/invite/:identifier',
    async (req, res) => {
      const invite = await dbService.getInviteOneByInvitationId(req.params.identifier)
      if (!invite) {
        res.status(400).json({ error: { message: 'There is no invite with that identifier.' } }).end()
      } else if (invite.issuerDid !== res.locals.tokenIssuer) {
        res.status(400).json({ error: { message: 'You do not own the invite with that identifier.' } }).end()
      } else {
        res.status(200).json({ data: invite }).end()
      }
    }
  )
