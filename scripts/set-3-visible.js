import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

var { UPORT_PUSH_TOKEN_HEADER } = require('../server/api/services/util')
var testUtil = require('../test/util')

var creds = testUtil.creds
var credentials = R.map((c) => new Credentials(c), creds)
let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)


let claimAttendance = {
  "@context": "http://schema.org",
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
     .post('/api/claim/makeMeGloballyVisible')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
     .send()
     .then(r => {
       console.log("Made 3 visible")
     })
     .catch((err) => {
       console.log("Got error making 3 visible:", err)
     })
    )

})
