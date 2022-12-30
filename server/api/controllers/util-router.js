import * as express from 'express'
import R from 'ramda'
import { withKeysSorted } from '../services/util'
import JwtService from '../services/jwt.service'

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
 * @group util - Utils
 * @route GET /util/objectWithKeysSorted
 * @param {obj} object.query.optional - the object which to sort
 * @returns {Array.ActionClaimsConfirmations} 200 - object with the order of all keys sorted
 * @returns {Error} default - Unexpected error
 */
  .get('/objectWithKeysSorted', (req, res) => res.json(withKeysSorted(JSON.parse(req.query.object))))

/**
 * Update all items with the hash chain.
 * @group util - Utils
 * @route POST /util/updateHashChain
 * @returns 200 - success
 * @returns {Error} default - Unexpected error
 */
  .post('/updateHashChain', (req, res) => JwtService.merkleUnmerkled().then(r => res.status(201).json({count:r.length, latest:R.last(r)}).end()).catch(err => { console.log(err); res.status(500).json(""+err).end(); }))
