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
  "@type": "Organization",
  name: "US Utah Davis County Government",
  member: {
    "@type": "OrganizationRole",
    member: {
      "@type": "Person",
      identifier: "", // "did:...:..."
    },
    roleName: "LandRecorder",
    startDate: "2000-00-01",
    endDate: "2009-12-31",
  },
}

let claimSecretary = {
  "@context": "http://schema.org",
  "@type": "Organization",
  name: "Cottonwood Cryptography Club",
  member: {
    "@type": "OrganizationRole",
    member: {
      "@type": "Person",
      identifier: "", // "did:...:..."
    },
    roleName: "Secretary",
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

let claimSecretaryFor2By2JwtObj = R.clone(testUtil.jwtTemplate)
claimSecretaryFor2By2JwtObj.claim = R.clone(claimSecretary)
claimSecretaryFor2By2JwtObj.claim.member.member.identifier = creds[2].did
claimSecretaryFor2By2JwtObj.iss = creds[2].did
claimSecretaryFor2By2JwtObj.sub = creds[2].did
let claimSecretaryFor2By2JwtProm = credentials[2].createVerification(claimSecretaryFor2By2JwtObj)

let claimPresidentFor3JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor3JwtObj.claim = R.clone(claimPresident)
claimPresidentFor3JwtObj.claim.member.member.identifier = creds[3].did
claimPresidentFor3JwtObj.sub = creds[3].did

let claimPresidentFor3By3JwtObj = R.clone(claimPresidentFor3JwtObj)
claimPresidentFor3By3JwtObj.iss = creds[3].did
let claimPresidentFor3By3JwtProm = credentials[3].createVerification(claimPresidentFor3By3JwtObj)

let claimPresidentFor3By5JwtObj = R.clone(claimPresidentFor3JwtObj)
claimPresidentFor3By5JwtObj.iss = creds[5].did
let claimPresidentFor3By5JwtProm = credentials[5].createVerification(claimPresidentFor3By5JwtObj)

let claimPresidentFor3By6JwtObj = R.clone(claimPresidentFor3JwtObj)
claimPresidentFor3By6JwtObj.iss = creds[6].did
let claimPresidentFor3By6JwtProm = credentials[6].createVerification(claimPresidentFor3By6JwtObj)

let claimPresidentFor4JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor4JwtObj.claim = R.clone(claimPresident)
claimPresidentFor4JwtObj.claim.member.member.identifier = creds[4].did
claimPresidentFor4JwtObj.sub = creds[4].did

let claimPresidentFor4By4JwtObj = R.clone(claimPresidentFor4JwtObj)
claimPresidentFor4By4JwtObj.iss = creds[4].did
let claimPresidentFor4By4JwtProm = credentials[4].createVerification(claimPresidentFor4By4JwtObj)

let claimPresidentFor4By7JwtObj = R.clone(claimPresidentFor4JwtObj)
claimPresidentFor4By7JwtObj.iss = creds[7].did
let claimPresidentFor4By7JwtProm = credentials[7].createVerification(claimPresidentFor4By7JwtObj)

let claimPresidentFor4By8JwtObj = R.clone(claimPresidentFor4JwtObj)
claimPresidentFor4By8JwtObj.iss = creds[8].did
let claimPresidentFor4By8JwtProm = credentials[8].createVerification(claimPresidentFor4By8JwtObj)

let claimPresidentFor4By9JwtObj = R.clone(claimPresidentFor4JwtObj)
claimPresidentFor4By9JwtObj.iss = creds[9].did
let claimPresidentFor4By9JwtProm = credentials[9].createVerification(claimPresidentFor4By9JwtObj)

var pushTokens, claimPresidentFor3By3JwtEnc, claimPresidentFor3By5JwtEnc, claimPresidentFor3By6JwtEnc,
    claimPresidentFor4By4JwtEnc, claimPresidentFor4By7JwtEnc, claimPresidentFor4By8JwtEnc, claimPresidentFor4By9JwtEnc,
    claimRecorderFor2By2JwtEnc, claimSecretaryFor2By2JwtEnc

before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claimPresidentFor3By3JwtProm,
    claimPresidentFor3By5JwtProm,
    claimPresidentFor3By6JwtProm,
    claimPresidentFor4By4JwtProm,
    claimPresidentFor4By7JwtProm,
    claimPresidentFor4By8JwtProm,
    claimPresidentFor4By9JwtProm,
    claimRecorderFor2By2JwtProm,
    claimSecretaryFor2By2JwtProm,
  ]).then((jwts) => {
    [
      claimPresidentFor3By3JwtEnc,
      claimPresidentFor3By5JwtEnc,
      claimPresidentFor3By6JwtEnc,
      claimPresidentFor4By4JwtEnc,
      claimPresidentFor4By7JwtEnc,
      claimPresidentFor4By8JwtEnc,
      claimPresidentFor4By9JwtEnc,
      claimRecorderFor2By2JwtEnc,
      claimSecretaryFor2By2JwtEnc,
    ] = jwts
    console.log("Created controller-roles user tokens", jwts)
  })

})

var claimId

async function postClaim(pushTokenNum, claimJwtEnc) {
  return request(Server)
    .post('/api/claim')
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[pushTokenNum])
    .send({jwtEncoded: claimJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).that.equals(++claimId)
      expect(r.body).to.be.a('number')
      expect(r.status).that.equals(201)
    }).catch((err) => {
      return Promise.reject(err)
    })
}

describe('Roles & Visibility', () => {

  it('should add a new LandRecorder role claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({jwtEncoded: claimRecorderFor2By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       claimId = r.body
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
    ).timeout(7001)

  it('should get a claim #1 with all DIDs hidden', () =>
     request(Server)
     .get('/api/claim/' + claimId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('Organization')
       expect(testUtil.allDidsAreHidden(r.body)).to.be.true
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should make user #2 visible to everyone', () =>
     request(Server)
     .post('/api/claim/makeMeGloballyVisible')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send()
     .then(r => {
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     }))

  it('should get a claim #2 with some DIDs shown', () =>
     request(Server)
     .get('/api/claim/' + claimId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(testUtil.allDidsAreHidden(r.body)).to.be.false
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should add a new Secretary role claim', () => postClaim(2, claimSecretaryFor2By2JwtEnc)).timeout(7001)

  it('should add a new President role claim', () => postClaim(3, claimPresidentFor3By3JwtEnc)).timeout(7001)
  it('should add another new President role claim', () => postClaim(4, claimPresidentFor4By4JwtEnc)).timeout(7001)
  it('should confirm 3 as President role claim by 5', () => postClaim(5, claimPresidentFor3By5JwtEnc)).timeout(7001)
  it('should confirm 3 as President role claim by 6', () => postClaim(6, claimPresidentFor3By6JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 7', () => postClaim(7, claimPresidentFor4By7JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 8', () => postClaim(8, claimPresidentFor4By8JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 9', () => postClaim(9, claimPresidentFor4By9JwtEnc)).timeout(7001)

})
