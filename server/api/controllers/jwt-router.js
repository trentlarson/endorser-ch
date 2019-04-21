import * as express from 'express';
import { PUSH_TOKEN_HEADER } from '../services/util'

import JwtService from '../services/jwt.service';
class Controller {
  getById(req, res) {
    let jwt = req.headers[PUSH_TOKEN_HEADER.toLowerCase()]
    if (!jwt) {
      res.status(401).json('Missing JWT').end()
    } else {
      JwtService.decodeAndVerifyJwt(jwt)
        .then(({payload, header, signature, data, doc, authenticators, issuer}) => {
          //console.log("Elements of the decoded JWT", {payload, header, signature, data, doc, authenticators, issuer})
          if (!payload || !header) {
            res.status(401).json('Unverified JWT').end()
          } else if (payload.exp < Math.floor(new Date().getTime() / 1000) ) {
            res.status(401).json('JWT Expired').end()
          } else if (header.typ === 'none') {
            res.status(401).json('Insecure JWT type').end()
          } else {
            JwtService
              .byId(req.params.id, payload.iss)
              .then(r => {
                if (r) res.json(r);
                else res.status(404).end();
              });
          }
        })
    }
  }
  getByQuery(req, res) {
    JwtService.byQuery(req.query)
      .then(r => res.json(r));
  }
  importClaim(req, res) {
    JwtService
      .createWithClaimRecord(req.body.jwtEncoded)
      .then(r => res
            .status(201)
            .location(`<%= apiRoot %>/claim/${r.id}`)
            .json(r));
  }
}
let controller = new Controller();


export default express
  .Router()
  .all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
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
 * Add a Claim JWT and insert claims into their own tables
 * @group jwt - Claim JWT storage
 * @route POST /api/claim
 * @param {EncodedJwt.model} jwt.body.required
 * @returns {object} 200 - internal ID of Claim JWT
 * @returns {Error}  default - Unexpected error
 */
  .post('/', controller.importClaim)
/**
 * Get many Claim JWTs
 * @group jwt - Claim JWT storage
 * @route GET /api/claim
 * @param {String} claimContents.query.optional This is exclusive and cannot be combined with other parameters.
 * @param {String} claimContext.query.optional
 * @param {String} claimType.query.optional
 * @param {String} issuedAt.query.optional
 * @param {String} subject.query.optional
 * @returns {Array.object} 200 - many Claim JWTs (up to 50)
 * @returns {Error}  default - Unexpected error
 */
  .get('/', controller.getByQuery)
/**
 * Get a Claim JWT
 * @group jwt - Claim JWT storage
 * @route GET /api/claim/{id}
 * @param {number} id.path.required - the ID of the Claim JWT record to retrieve
 * @returns {object} 200 - Claim JWT if it exists, otherwise 404
 * @returns {Error}  default - Unexpected error
 */
 .get('/:id', controller.getById)
 /**
 * Add a Claim JWT raw, without any processing (not recommended)
 * @group jwt - Claim JWT storage
 * @route POST /api/claim/raw
 * @param {string} jwt.body.required
 * @returns {object} 200 - internal ID of Claim JWT
 * @returns {Error}  default - Unexpected error
 *
  .post('/raw', controller.create)
 */

