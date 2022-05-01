/**

 This walks through all JWTs to recreate records in the 'confirmation' table.
 So delete all from that table first.

 Run at top level with: npm run reset-confirms

**/

import DBService from '../server/api/services/endorser.db.service'
import JwtService from '../server/api/services/jwt.service'

describe('Running Script', () => {

  it('reset confirms', async () => {
    let nextId = '0'
    const params = {}
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
              console.log('Got this error on', thisDatum.id, ':', err)
            }
          }
          nextId = results.maybeMoreAfter
        })
    } while (nextId)
  })

})
