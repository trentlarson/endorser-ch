import * as express from 'express'
import R from 'ramda'

import ClaimService from '../services/claim.service'
import { allEmbeddedRecordErrorsInside, GLOBAL_ENTITY_ID_IRI_PREFIX, isGlobalUri } from '../services/util'
import { hideDidsAndAddLinksToNetwork } from '../services/util-higher'
class ClaimController {

  getById(req, res) {
    ClaimService
      .byId(req.params.id, res.locals.tokenIssuer)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result, []))
      .then(r => {
        if (r) res.json(r);
        else res.status(404).end();
      })
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }

  async getFullClaimById(req, res) {
    ClaimService
      .fullJwtById(req.params.id, res.locals.tokenIssuer)
      .then(result => new Promise((resolve, reject) => {
        if (!result) {
          reject(
            { error: { message: "No claim found with ID " + req.params.id } }
          )
        }
        hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result, [])
          .then(scrubbed => {
            let resultClaim = JSON.parse(result.claim)
            hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, resultClaim, [])
              .then(scrubbedClaim => {
                resolve({
                  fullJwt: result,
                  fullClaim: resultClaim,
                  scrubbedJwt: R.omit(['publicUrls'], scrubbed),
                  scrubbedClaim: R.omit(['publicUrls'], scrubbedClaim)
                })
              })
              .catch(err => reject(err))
          })
          .catch(err => reject(err))
      }))
      .then(r => {
        if (r
            && R.equals(r.fullJwt, r.scrubbedJwt)
            && R.equals(r.fullClaim, r.scrubbedClaim)
           ) {
          res.json(r.fullJwt);
        } else {
          res.status(403).json(`Sorry, but claim ${req.params.id} has elements that are hidden from user ${res.locals.tokenIssuer}.  Use a different endpoint to get scrubbed data.`).end();
        }
      })
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }

  getByQuery(req, res) {
    const searchTermMaybeDIDs = [req.query.claimContents, req.query.issuer, req.query.subject, req.query.handleId]
    ClaimService.byQuery(req.query)
      .then(result => hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result, searchTermMaybeDIDs))
      .then(r => res.json(r))
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }

  importClaim(req, res) {
    if (!req.body.jwtEncoded) {
      res.status(400).json("Request body is missing a 'jwtEncoded' property.").end();
      return;
    }
    ClaimService
      .createWithClaimEntry(req.body.jwtEncoded, res.locals.tokenIssuer)
      // no need to check for visible data because they sent it
      .then(r => {
        const result = r.claimId

        // show a message about other values
        const allKeys = Object.keys(r)
        if (allKeys.length > 1) {
          //console.log("Got extra values in deprecated importClaim which will not be reported to creator of", r.claimId, JSON.stringify(allKeys))
          const embeddedValues = allEmbeddedRecordErrorsInside(r)
          if (embeddedValues.length > 0) {
            console.error("Got embeddedRecordError in deprecated importClaim which will not be reported to creator of", r.claimId, embeddedValues)
          }
        }

        return res
          .status(201)
          .location(`<%= apiRoot %>/api/claim/${r.id}`)
          .json(result)
      })
      .catch(err => {
        if (err.clientError) {
          res.status(400).json({ error: { message: err.clientError.message, code: err.clientError.code } })
        } else {
          console.error(err)
          res.status(500).json({ error: "" + err }).end()
        }
      })
  }

}
let claimController = new ClaimController()




import { dbService } from '../services/endorser.db.service';
class DbController {
  getLastClaimWithHandleId(req, res) {
    const handleId =
      isGlobalUri(req.params.id) ? req.params.id : GLOBAL_ENTITY_ID_IRI_PREFIX + req.params.id
    dbService.jwtLastByHandleId(handleId)
      .then(result => {
        if (result) {
          result.claim = JSON.parse(result.claim)
          return hideDidsAndAddLinksToNetwork(res.locals.tokenIssuer, result, [])
        } else {
          return null
        }
      })
      .then(r => { if (r) { res.json(r) } else { res.status(404).end() } })
      .catch(err => { console.error(err); res.status(500).json(""+err).end(); })
  }
}
let dbController = new DbController()





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
 * @typedef EncodedJwt
 * @property {string} jwtEncoded.required
 */

/**
 * Get many Claim JWTs
 *
 * Beware: this array may include a "publicUrls" key within it.
 *
 * @group claims v1 - Claim Entry (with limited feedback)
 * @route GET /api/claim
 * @param {string} claimContents.query.optional
 * @param {string} claimContext.query.optional
 * @param {string} claimType.query.optional
 * @param {string} issuedAt.query.optional
 * @param {string} subject.query.optional
 * @returns {array.object} 200 - many Claim JWTs (up to 50), with claimEncoded only if issued by this requester
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/', claimController.getByQuery)

/**
 * Get a Claim JWT
 * @group claims v1 - Claim Entry (with limited feedback)
 * @route GET /api/claim/{id}
 * @param {string} id.path.required - the ID of the Claim JWT entry to retrieve
 * @returns {object} 200 - Claim JWT if it exists, otherwise 404
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/:id', claimController.getById)

/**
 * Get most recent "entity" (claim that matches an handle ID)
 *
 * @group claims v1 - Claim Entry (with limited feedback)
 * @route GET /api/claim/byHandle/{id}
 * @param {string} id.params.required - the persistent "entity" handle ID
 * @returns {Jwt} 200 - the Claim JWT entry with the most recent changes for that handle ID
 * @returns {''} 404 - if nothing found
 * @returns {Error} default - Unexpected error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/byHandle/:id', dbController.getLastClaimWithHandleId)

/**
 * Get a Claim JWT with full encoding
 * @group claims v1 - Claim Entry (with limited feedback)
 * @route GET /api/claim/full/{id}
 * @param {string} id.path.required - the ID of the Claim JWT entry to retrieve
 * @returns {object} 200 - Claim JWT if it exists and user can see all data, otherwise 404
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
  .get('/full/:id', claimController.getFullClaimById)

/**
 * Add a Claim JWT and insert claims into their own tables
 * @deprecated use the v2 version (or you'll miss info like the nonce)
 *
 * @group claims v1 deprecated - Claim Entry (without complete feedback)
 * @route POST /api/claim
 * @param {EncodedJwt.model} jwtEncoded.body.required
 * @returns {object} 200 - internal ID of Claim JWT
 * @returns {Error} 400 - error
 */
// This comment makes doctrine-file work with babel. See API docs after: npm run compile; npm start
.post('/', claimController.importClaim)
