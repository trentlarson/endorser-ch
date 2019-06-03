import chai from 'chai'
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { calcBbox, hideDids, HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const START_TIME_STRING = '2018-12-29T08:00:00.000-07:00'
const DAY_START_TIME_STRING = DateTime.fromISO(START_TIME_STRING).set({hour:0}).startOf("day").toISO()
const TODAY_START_TIME_STRING = DateTime.local().set({hour:0}).startOf("day").toISO()

var creds = testUtil.creds

let claimRecorder = {
  "@context": "http://schema.org",
  "@type": "Person",
  jobTitle: "LandRecorder",
  identifier: "" // "did:...:..."
}

var credentials = R.map((c) => new Credentials(c), creds)

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let claimRecorderFor2By2JwtObj = R.clone(testUtil.jwtTemplate)
claimRecorderFor2By2JwtObj.claim = R.clone(claimRecorder)
claimRecorderFor2By2JwtObj.claim.identifier = creds[2].did
claimRecorderFor2By2JwtObj.iss = creds[2].did
claimRecorderFor2By2JwtObj.sub = creds[2].did
let claimRecorderFor2By2JwtProm = credentials[0].createVerification(claimRecorderFor2By2JwtObj)

var pushTokens, claimRecorderFor2By2JwtEnc

before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claimRecorderFor2By2JwtProm,
  ]).then((jwts) => {
    claimRecorderFor2By2JwtEnc = jwts[0]
    console.log("Created controller-roles user tokens", jwts)
  })

})

var firstId

describe('Role', () => {

  it('should add a new LandRecorder role claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({jwtEncoded: claimRecorderFor2By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
       firstId = r.body
     })).timeout(7001)

})
