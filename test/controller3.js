import chai from 'chai'
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const START_TIME_STRING = '2018-12-29T08:00:00.000-07:00'
const DAY_START_TIME_STRING = DateTime.fromISO(START_TIME_STRING).set({hour:0}).startOf("day").toISO()
const TODAY_START_TIME_STRING = DateTime.local().set({hour:0}).startOf("day").toISO()

var creds = testUtil.creds

let claimRecorder = {
  "@context": "http://schema.org",
  "@type": "Person",
  name: "Person",
  identifier: "", // "did:...:..."
  knowsAbout: "carpentry"
}

var credentials = R.map((c) => new Credentials(c), creds)

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let claimCarpentryFor1By2JwtObj = R.clone(testUtil.jwtTemplate)
claimCarpentryFor1By2JwtObj.claim = R.clone(claimRecorder)
claimCarpentryFor1By2JwtObj.claim.identifier = creds[1].did
claimCarpentryFor1By2JwtObj.iss = creds[2].did
claimCarpentryFor1By2JwtObj.sub = creds[1].did
let claimCarpentryFor1By2JwtProm = credentials[2].createVerification(claimCarpentryFor1By2JwtObj)

var pushTokens, claimCarpentryFor1By2JwtEnc
before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claimCarpentryFor1By2JwtProm,
  ]).then((jwts) => {
    [
      claimCarpentryFor1By2JwtEnc,
    ] = jwts
    console.log("Created controller3 user tokens", jwts)
  })

})

var claimId
describe('Roles & Visibility', () => {

  it('add a new carpentry skill role claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({jwtEncoded: claimCarpentryFor1By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       claimId = r.body
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
       ).timeout(7001)

})
