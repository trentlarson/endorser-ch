/**
 * See partner-link.service.js for an explanation why these endpoints are kept separate.
 */

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
 * @param {string} jwtId.body.required - the claim to relay to the partner
 * @param {string} linkCode.body.required - the partner link code, eg. 'NOSTR-EVENT' (or someday: 'ATTEST.SH')
 * @returns 201 - success
 * @returns {Error} 400 - client error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.post(
  '/link',
  async (req, res) => {
    // this will check if the issuer actually created the JWT, so no need to check registration limits
    const result =
      await sendAndStoreLink(
        res.locals.tokenIssuer,
        req.body.jwtId,
        req.body.linkCode,
        req.body.inputJson,
        req.body.pubKeyHex || req.body.nostrPubKeyHex, // the latter was only used for a short time
        req.body.pubKeyImage,
        req.body.pubKeySigHex,
      )
    if (result.clientError) {
      res.status(400).json({ error: result.clientError }).end()
    } else if (result.error) {
      // this is a server error, not a client error; we assume something went to the logs inside the method call
      res.status(500).json({ error: result }).end()
    } else {
      res.status(201).json({ success: result }).end()
    }
  }
)
