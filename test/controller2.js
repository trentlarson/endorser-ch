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
  "@type": "Organization",
  name: "US Utah Davis County Government",
  member: {
    "@type": "OrganizationRole",
    member: {
      "@type": "Person",
      identifier: "", // "did:...:..."
    },
    roleName: "President",
    startDate: "2019-04-01",
    endDate: "2020-03-31",
  },
}

let claimPresident = {
  "@context": "http://schema.org",
  "@type": "Organization",
  name: "Cottonwood Cryptography Club",
  member: {
    "@type": "OrganizationRole",
    member: {
      "@type": "Person",
      identifier: "", // "did:...:..."
    },
    roleName: "President",
    startDate: "2019-04-01",
    endDate: "2020-03-31",
  },
}

var credentials = R.map((c) => new Credentials(c), creds)

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let claimRecorderFor2By2JwtObj = R.clone(testUtil.jwtTemplate)
claimRecorderFor2By2JwtObj.claim = R.clone(claimRecorder)
claimRecorderFor2By2JwtObj.claim.member.member.identifier = creds[2].did
claimRecorderFor2By2JwtObj.iss = creds[2].did
claimRecorderFor2By2JwtObj.sub = creds[2].did
let claimRecorderFor2By2JwtProm = credentials[2].createVerification(claimRecorderFor2By2JwtObj)

let claimPresidentFor3By3JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor3By3JwtObj.claim = R.clone(claimPresident)
claimPresidentFor3By3JwtObj.claim.member.member.identifier = creds[3].did
claimPresidentFor3By3JwtObj.iss = creds[3].did
claimPresidentFor3By3JwtObj.sub = creds[3].did
let claimPresidentFor3By3JwtProm = credentials[3].createVerification(claimPresidentFor3By3JwtObj)

let claimPresidentFor4By4JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor4By4JwtObj.claim = R.clone(claimPresident)
claimPresidentFor4By4JwtObj.claim.member.member.identifier = creds[4].did
claimPresidentFor4By4JwtObj.iss = creds[4].did
claimPresidentFor4By4JwtObj.sub = creds[4].did
let claimPresidentFor4By4JwtProm = credentials[4].createVerification(claimPresidentFor4By4JwtObj)

var pushTokens, claimRecorderFor2By2JwtEnc, claimPresidentFor3By3JwtEnc, claimPresidentFor4By4JwtEnc

before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claimRecorderFor2By2JwtProm,
    claimPresidentFor3By3JwtProm,
    claimPresidentFor4By4JwtProm,
  ]).then((jwts) => {
    [
      claimRecorderFor2By2JwtEnc,
      claimPresidentFor3By3JwtEnc,
      claimPresidentFor4By4JwtEnc,
    ] = jwts
    console.log("Created controller-roles user tokens", jwts)
  })

})

var firstId = -1

async function postClaim(pushToken, claimJwtEnc) {
  return request(Server)
    .post('/api/claim')
    .set(UPORT_PUSH_TOKEN_HEADER, pushToken)
    .send({jwtEncoded: claimJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(201)
      expect(r.body)
        .to.be.a('number')
      if (firstId === -1) {
        firstId = r.body
      } else {
        expect(r.body)
          .that.equals(firstId++)
      }
      firstId = r.body
    }).catch((err) => {
      return Promise.reject(err)
    })
}

describe('Role', () => {
  it('should add a new LandRecorder role claim', () => postClaim(pushTokens[2], claimRecorderFor2By2JwtEnc)).timeout(7001)
  it('should add a new President role claim', () => postClaim(pushTokens[3], claimPresidentFor3By3JwtEnc)).timeout(7001)
  it('should add another new President role claim', () => postClaim(pushTokens[4], claimPresidentFor4By4JwtEnc)).timeout(7001)

})
