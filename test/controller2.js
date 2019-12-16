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

let claimPresidentFor3 = R.clone(claimPresident)
claimPresidentFor3.member.member.identifier = creds[3].did

let claimPresidentFor3By3JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor3By3JwtObj.claim = R.clone(claimPresidentFor3)
claimPresidentFor3By3JwtObj.iss = creds[3].did
claimPresidentFor3By3JwtObj.sub = creds[3].did
let claimPresidentFor3By3JwtProm = credentials[3].createVerification(claimPresidentFor3By3JwtObj)

let confirmPresidentFor3By5JwtObj = R.clone(testUtil.jwtTemplate)
confirmPresidentFor3By5JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmPresidentFor3By5JwtObj.claim.originalClaims.push(R.clone(claimPresidentFor3))
confirmPresidentFor3By5JwtObj.iss = creds[5].did
confirmPresidentFor3By5JwtObj.sub = creds[3].did
let confirmPresidentFor3By5JwtProm = credentials[5].createVerification(confirmPresidentFor3By5JwtObj)

let confirmPresidentFor3By6JwtObj = R.clone(testUtil.jwtTemplate)
confirmPresidentFor3By6JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmPresidentFor3By6JwtObj.claim.originalClaims.push(R.clone(claimPresidentFor3))
confirmPresidentFor3By6JwtObj.iss = creds[6].did
confirmPresidentFor3By6JwtObj.sub = creds[3].did
let confirmPresidentFor3By6JwtProm = credentials[6].createVerification(confirmPresidentFor3By6JwtObj)



let claimPresidentFor4 = R.clone(claimPresident)
claimPresidentFor4.member.member.identifier = creds[4].did

let claimPresidentFor4By4JwtObj = R.clone(testUtil.jwtTemplate)
claimPresidentFor4By4JwtObj.claim = R.clone(claimPresidentFor4)
claimPresidentFor4By4JwtObj.iss = creds[4].did
claimPresidentFor4By4JwtObj.sub = creds[4].did
let claimPresidentFor4By4JwtProm = credentials[4].createVerification(claimPresidentFor4By4JwtObj)



let confirmPresidentFor4By7JwtObj = R.clone(testUtil.jwtTemplate)
confirmPresidentFor4By7JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmPresidentFor4By7JwtObj.claim.originalClaims.push(R.clone(claimPresidentFor4))
confirmPresidentFor4By7JwtObj.iss = creds[7].did
confirmPresidentFor4By7JwtObj.sub = creds[4].did
let confirmPresidentFor4By7JwtProm = credentials[7].createVerification(confirmPresidentFor4By7JwtObj)

let confirmPresidentFor4By8JwtObj = R.clone(testUtil.jwtTemplate)
confirmPresidentFor4By8JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmPresidentFor4By8JwtObj.claim.originalClaims.push(R.clone(claimPresidentFor4))
confirmPresidentFor4By8JwtObj.iss = creds[8].did
confirmPresidentFor4By8JwtObj.sub = creds[4].did
let confirmPresidentFor4By8JwtProm = credentials[8].createVerification(confirmPresidentFor4By8JwtObj)

let confirmPresidentFor4By9JwtObj = R.clone(testUtil.jwtTemplate)
confirmPresidentFor4By9JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmPresidentFor4By9JwtObj.claim.originalClaims.push(R.clone(claimPresidentFor4))
confirmPresidentFor4By9JwtObj.iss = creds[9].did
confirmPresidentFor4By9JwtObj.sub = creds[4].did
let confirmPresidentFor4By9JwtProm = credentials[9].createVerification(confirmPresidentFor4By9JwtObj)

var pushTokens, claimPresidentFor3By3JwtEnc, confirmPresidentFor3By5JwtEnc, confirmPresidentFor3By6JwtEnc,
    claimPresidentFor4By4JwtEnc, confirmPresidentFor4By7JwtEnc, confirmPresidentFor4By8JwtEnc, confirmPresidentFor4By9JwtEnc,
    claimRecorderFor2By2JwtEnc, claimSecretaryFor2By2JwtEnc

before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller2 push tokens", pushTokens) })

  await Promise.all([
    claimPresidentFor3By3JwtProm,
    confirmPresidentFor3By5JwtProm,
    confirmPresidentFor3By6JwtProm,
    claimPresidentFor4By4JwtProm,
    confirmPresidentFor4By7JwtProm,
    confirmPresidentFor4By8JwtProm,
    confirmPresidentFor4By9JwtProm,
    claimRecorderFor2By2JwtProm,
    claimSecretaryFor2By2JwtProm,
  ]).then((jwts) => {
    [
      claimPresidentFor3By3JwtEnc,
      confirmPresidentFor3By5JwtEnc,
      confirmPresidentFor3By6JwtEnc,
      claimPresidentFor4By4JwtEnc,
      confirmPresidentFor4By7JwtEnc,
      confirmPresidentFor4By8JwtEnc,
      confirmPresidentFor4By9JwtEnc,
      claimRecorderFor2By2JwtEnc,
      claimSecretaryFor2By2JwtEnc,
    ] = jwts
    console.log("Created controller2 user tokens", jwts)
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
       expect(r.body)
         .that.does.not.have.property('publicUrls')
       expect(testUtil.allDidsAreHidden(r.body)).to.be.true
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should see one DID', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[5])
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body).that.deep.equals([creds[5].did])
     }).catch((err) => {
       return Promise.reject(err)
     }))

  it('should make user #2 visible to everyone', () =>
     request(Server)
     .post('/api/report/makeMeGloballyVisible')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({"url":"https://ignitecommunity.org"})
     .then(r => {
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     }))

  it('should see two DIDs', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[5])
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body).that.deep.equals([creds[2].did, creds[5].did])
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
       expect(r.body)
         .that.has.a.property('publicUrls')
         .that.deep.equals({"did:ethr:0x22c51a43844e44b59c112cf74f3f5797a057837a":'https://ignitecommunity.org'})
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should add a new Secretary role claim', () => postClaim(2, claimSecretaryFor2By2JwtEnc)).timeout(7001)
  it('should add a new President role claim', () => postClaim(3, claimPresidentFor3By3JwtEnc)).timeout(7001)
  it('should add another new President role claim', () => postClaim(4, claimPresidentFor4By4JwtEnc)).timeout(7001)
  it('should confirm 3 as President role claim by 5', () => postClaim(5, confirmPresidentFor3By5JwtEnc)).timeout(7001)
  it('should confirm 3 as President role claim by 6', () => postClaim(6, confirmPresidentFor3By6JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 7', () => postClaim(7, confirmPresidentFor4By7JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 8', () => postClaim(8, confirmPresidentFor4By8JwtEnc)).timeout(7001)
  it('should confirm 4 as President role claim by 9', () => postClaim(9, confirmPresidentFor4By9JwtEnc)).timeout(7001)

  it('should get org role claims & confirmations', () =>
     request(Server)
     .get('/api/report/orgRoleClaimsAndConfirmationsOnDate?orgName=Cottonwood%20Cryptography%20Club&roleName=President&onDate=2019-07-01')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array').of.length(2)
       expect(testUtil.allDidsAreHidden(r.body[0])).to.be.false
       expect(r.body[0].orgRoles[0].confirmations).to.be.an('array').of.length(2)
       expect(r.body[0].orgRoles[0].orgRole.memberDid).to.equal('did:ethr:0x332661e9e6af65eea6df253296a26257ff304647')
       expect(testUtil.allDidsAreHidden(r.body[1])).to.be.true
       expect(r.body[1].orgRoles[0].confirmations).to.be.an('array').of.length(3)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})
