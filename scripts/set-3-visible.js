/**

 Run at top level with: npm run set-3-visible

**/

import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

var { UPORT_PUSH_TOKEN_HEADER } = require('../server/api/services/util')
var testUtil = require('../test/util')

var creds = testUtil.credData
var credentials = R.map((c) => new Credentials(c), creds)
let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)


let claimAttendance = {
  "@context": "https://schema.org",
  "@type": "JoinAction",
  agent: {
    did: creds[4]
  },
  event: {
    organizer: { name: "Bountiful Voluntaryist Community" },
    name: "Saturday Morning Meeting",
    startTime: "2018-12-29T08:00:00.000-07:00"
  }
}

let serverRequest = request('http://localhost:3000')

var pushTokens
before(async () => {
  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts })
})

describe('Visibility setup', () => {

  it('make user 3 globally visible', () =>
     serverRequest
     .post('/api/report/makeMeGloballyVisible')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
     .send({url: "https://SomebodyTrustworthy.com"})
     .then(r => {
       if (r.status != 201) { throw "Got bad result of " + r.status }
       console.log("Made 3 visible.")
     })
    )

})
