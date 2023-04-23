import * as express from 'express'
import R from 'ramda'
import { withKeysSorted } from '../services/util'
import ClaimService from '../services/claim.service'
import {
  cacheContactList,
  getContactMatch,
} from "../services/contact-correlation.service";

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
 * Get sorted version of any object (using the function used internally for generating preimages)
 * @group utils - Utils
 * @route GET /api/util/objectWithKeysSorted
 * @param {object} object.query.optional - the object which to sort
 * @returns {array.ActionClaimsConfirmations} 200 - { data: ...} containing an object with the order of all keys sorted
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/objectWithKeysSorted',
       (req, res) => res.json({data: withKeysSorted(JSON.parse(req.query.object))})
  )

/**
 * Update all items with the hash chain.
 * @group utils - Utils
 * @route POST /api/util/updateHashChain
 * @returns 201 - updated results: { data: { count, latest } }
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post('/updateHashChain',
        (req, res) =>
          ClaimService.merkleUnmerkled()
          .then(r => res.status(201).json({data: {count:r.length, latest:R.last(r)}}).end())
          .catch(err => { console.log(err); res.status(500).json(""+err).end(); })
  )

/**
 * Update the contact lookup cache for this user & their counterparty
 *
 * @group utils - Utils
 * @route POST /api/util/correlateContacts
 * @param {string} counterparty.query.required - the other party with whom to compare
 * @param {Array<string>} contactHashes.body.required
 * @returns 201 - { data: ... } with:
 * - "NEED_COUNTERPARTY_DATA" if counterparty hasn't sent theirs
 * - { matches: [...] } with any matching IDs, possibly empty
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .post(
    '/cacheContactList',
    (req, res) => {
      const result = cacheContactList(res.locals.tokenIssuer, req.query.counterparty, req.body.contactHashes)
      res.status(201).json(result).end()
    }
  )

/**
 * Retrieve the matching contacts for this user & their counterparty
 *
 * @group utils - Utils
 * @route GET /api/util/getContactMatch
 * @param {string} counterparty.query.required - the other party with whom to compare
 * @returns 200 - { data: ... } with
 * - "NEED_COUNTERPARTY_DATA" if counterparty hasn't sent theirs
 * - { matches: [...] } with any matching IDs, possibly empty
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get(
      '/getContactMatch',
      (req, res) => {
        const result = getContactMatch(res.locals.tokenIssuer, req.query.counterparty)
        res.status(200).json(result).end()
      }
  )
