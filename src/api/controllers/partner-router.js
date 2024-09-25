import * as express from 'express'
import { sendAndStoreLink } from "../services/partner-link.service";

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
 * Add a link to some partner service
 *
 * @group partner utils - Partner Utils
 * @route POST /api/partner/link
 * @param {string} jwtId.query.required - the claim to relay to the partner
 * @param {string} linkCode.body.required - the partner link code, eg. 'NOSTR-EVENT' (or someday: 'ATTEST.SH')
 * @returns 201
 *
 * @returns {Error} 500 - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.post(
  '/link',
  async (req, res) => {
    // this will check if the issuer actually created the JWT, so no need to check registration limits
    const result =
      await sendAndStoreLink(res.locals.tokenIssuer, req.query.jwtId, req.query.linkCode, req.query.nostrPubKeyHex, req.query.inputJson)
    if (result.clientError) {
      res.status(400).json({ error: result.clientError }).end()
    } else if (result.error) {
      res.status(500).json({ error: result }).end()
    } else {
      res.status(201).json({ success: result }).end()
    }
  }
)
