/**

 This walks through all JWTs to recreate fields in the JWT table.
 You'll have to add the jwtEncoded in the jwtsByParamsPaged method in endorser.db.service.js

 Run at top level with: NODE_ENV=... npm run reset-claim-fields

**/

import base64url from 'base64url'
import canonicalize from 'canonicalize'
import { dbService as DBService } from '../src/api/services/endorser.db.service'
import ClaimService from '../src/api/services/claim.service'
import { decodeAndVerifyJwt } from '../src/api/services/vc/index'

describe('Running Script', () => {

  it('reset claim fields', async () => {
    let nextId = '0'
    do {
      let thisPage = await DBService.jwtsByParamsPaged({}, nextId)
        .then(async results => {
          console.log('Doing another batch of', results.data.length, 'at', new Date())
          const promises = []
          for (let i = 0; i < results.data.length; i++) {
            const thisDatum = results.data[i]
            // This part is pulled from ClaimService.createWithClaimEntry
            promises.push(
              decodeAndVerifyJwt(thisDatum.jwtEncoded).then(result => {
                const {payload, header, signature, data, doc, authenticators, issuer} = result
                const payloadClaim = ClaimService.extractClaim(payload)
                thisDatum.claimContext = payloadClaim['@context']
                thisDatum.claimType = payloadClaim['@type']
                const payloadClaimStr = canonicalize(payloadClaim)
                thisDatum.claim = payloadClaimStr
                thisDatum.claimEncoded = base64url.encode(payloadClaimStr)
                return DBService.jwtUpdateClaimFields(thisDatum)
              })
            )
          }
          await Promise.all(promises).catch(console.log)
          nextId = results.maybeMoreAfter
        })
    } while (nextId)
  }).timeout(120000)

})
