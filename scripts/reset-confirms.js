/**

 This walks through all JWTs to recreate records in the ancillary tables.
 So delete all from those tables first. As of now, these tables need erasing: action_claim, confirmation, event, and org_role_claim
 Also: change the 'legacy context' checks at the top of jwt.service.js.

 Run at top level with: NODE_ENV=... npm run reset-confirms

**/

import DBService from '../server/api/services/endorser.db.service'
import JwtService from '../server/api/services/jwt.service'

describe('Running Script', () => {

  it('reset confirms', async () => {
    let nextId = '0'
    const params = {}
    let repeatConfirms = 0
    do {
      let thisPage = await DBService.jwtsByParamsPaged(params, nextId)
        .then(async results => {
          let resultEmbeds = []
          console.log('Doing another batch of',results.data.length)
          for (let i = 0; i < results.data.length; i++) {
            const thisDatum = results.data[i]
            try {
              await JwtService.createEmbeddedClaimRecords(thisDatum.id, thisDatum.issuer, JSON.parse(thisDatum.claim))
            } catch (err) {
              if (err.message.indexOf('Attempted to confirm') > -1 && err.message.indexOf('already confirmed') > -1) {
                repeatConfirms++
              } else {
                console.log('Got this error on', thisDatum.id, ':', err)
              }
            }
          }
          nextId = results.maybeMoreAfter
        })
    } while (nextId)
    console.log('Got', repeatConfirms, 'repeat confirms.')
  }).timeout(30000)

})
