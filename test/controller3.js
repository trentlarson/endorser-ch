import chai from 'chai'
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const START_TIME_STRING = '2018-12-29T08:00:00.000-07:00'
const DAY_START_TIME_STRING = DateTime.fromISO(START_TIME_STRING).set({hour:0}).startOf("day").toISO()
const TODAY_START_TIME_STRING = DateTime.local().set({hour:0}).startOf("day").toISO()

var creds = testUtil.creds

let claimCarpentry = {
  "@context": "http://schema.org",
  "@type": "Person",
  name: "Person",
  identifier: null, // change to "did:...:..."
  knowsAbout: "carpentry"
}

var credentials = R.map((c) => new Credentials(c), creds)

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let claim_Carpentry_For0 = R.clone(claimCarpentry)
claim_Carpentry_For0.identifier = creds[0].did

let claim_Carpentry_For0_By0_JwtObj = R.clone(testUtil.jwtTemplate)
claim_Carpentry_For0_By0_JwtObj.claim = R.clone(claim_Carpentry_For0)
claim_Carpentry_For0_By0_JwtObj.iss = creds[0].did
claim_Carpentry_For0_By0_JwtObj.sub = creds[0].did
let claim_Carpentry_For0_By0_JwtProm = credentials[0].createVerification(claim_Carpentry_For0_By0_JwtObj)

let claim_Carpentry_For3 = R.clone(claimCarpentry)
claim_Carpentry_For3.identifier = creds[3].did

let claim_Carpentry_For3_By4_JwtObj = R.clone(testUtil.jwtTemplate)
claim_Carpentry_For3_By4_JwtObj.claim = R.clone(claim_Carpentry_For3)
claim_Carpentry_For3_By4_JwtObj.iss = creds[4].did
claim_Carpentry_For3_By4_JwtObj.sub = creds[3].did
let claim_Carpentry_For3_By4_JwtProm = credentials[4].createVerification(claim_Carpentry_For3_By4_JwtObj)

let confirm_Carpentry_For3_By4_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For3_By4_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For3_By4_JwtObj.claim.object.push(R.clone(claim_Carpentry_For3))
confirm_Carpentry_For3_By4_JwtObj.iss = creds[4].did
confirm_Carpentry_For3_By4_JwtObj.sub = creds[3].did
let confirm_Carpentry_For3_By4_JwtProm = credentials[4].createVerification(confirm_Carpentry_For3_By4_JwtObj)

let confirm_Carpentry_For3_By5_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For3_By5_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For3_By5_JwtObj.claim.object.push(R.clone(claim_Carpentry_For3))
confirm_Carpentry_For3_By5_JwtObj.iss = creds[5].did
confirm_Carpentry_For3_By5_JwtObj.sub = creds[3].did
let confirm_Carpentry_For3_By5_JwtProm = credentials[5].createVerification(confirm_Carpentry_For3_By5_JwtObj)

let confirm_Carpentry_For3_By6_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For3_By6_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For3_By6_JwtObj.claim.object.push(R.clone(claim_Carpentry_For3))
confirm_Carpentry_For3_By6_JwtObj.iss = creds[6].did
confirm_Carpentry_For3_By6_JwtObj.sub = creds[3].did
let confirm_Carpentry_For3_By6_JwtProm = credentials[6].createVerification(confirm_Carpentry_For3_By6_JwtObj)




let claim_Carpentry_For4 = R.clone(claimCarpentry)
claim_Carpentry_For4.identifier = creds[4].did

let claim_Carpentry_For4_By4_JwtObj = R.clone(testUtil.jwtTemplate)
claim_Carpentry_For4_By4_JwtObj.claim = R.clone(claim_Carpentry_For4)
claim_Carpentry_For4_By4_JwtObj.iss = creds[4].did
claim_Carpentry_For4_By4_JwtObj.sub = creds[4].did
let claim_Carpentry_For4_By4_JwtProm = credentials[4].createVerification(claim_Carpentry_For4_By4_JwtObj)

let confirm_Carpentry_For4_By2_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For4_By2_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For4_By2_JwtObj.claim.object.push(R.clone(claim_Carpentry_For4))
confirm_Carpentry_For4_By2_JwtObj.iss = creds[2].did
confirm_Carpentry_For4_By2_JwtObj.sub = creds[4].did
let confirm_Carpentry_For4_By2_JwtProm = credentials[2].createVerification(confirm_Carpentry_For4_By2_JwtObj)

let confirm_Carpentry_For4_By6_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For4_By6_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For4_By6_JwtObj.claim.object.push(R.clone(claim_Carpentry_For4))
confirm_Carpentry_For4_By6_JwtObj.iss = creds[6].did
confirm_Carpentry_For4_By6_JwtObj.sub = creds[4].did
let confirm_Carpentry_For4_By6_JwtProm = credentials[6].createVerification(confirm_Carpentry_For4_By6_JwtObj)



let claim_Carpentry_For7 = R.clone(claimCarpentry)
claim_Carpentry_For7.identifier = creds[7].did

let claim_Carpentry_For7_By7_JwtObj = R.clone(testUtil.jwtTemplate)
claim_Carpentry_For7_By7_JwtObj.claim = R.clone(claim_Carpentry_For7)
claim_Carpentry_For7_By7_JwtObj.iss = creds[7].did
claim_Carpentry_For7_By7_JwtObj.sub = creds[7].did
let claim_Carpentry_For7_By7_JwtProm = credentials[7].createVerification(claim_Carpentry_For7_By7_JwtObj)

let confirm_Carpentry_For7_By4_JwtObj = R.clone(testUtil.jwtTemplate)
confirm_Carpentry_For7_By4_JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirm_Carpentry_For7_By4_JwtObj.claim.object.push(R.clone(claim_Carpentry_For4))
confirm_Carpentry_For7_By4_JwtObj.iss = creds[4].did
confirm_Carpentry_For7_By4_JwtObj.sub = creds[7].did
let confirm_Carpentry_For7_By4_JwtProm = credentials[4].createVerification(confirm_Carpentry_For7_By4_JwtObj)






var pushTokens,
    claim_Carpentry_For0_By0_JwtEnc,
    claim_Carpentry_For3_By4_JwtEnc,
    confirm_Carpentry_For3_By4_JwtEnc,
    confirm_Carpentry_For3_By5_JwtEnc,
    confirm_Carpentry_For3_By6_JwtEnc,
    claim_Carpentry_For4_By4_JwtEnc,
    confirm_Carpentry_For4_By2_JwtEnc,
    confirm_Carpentry_For4_By6_JwtEnc,
    claim_Carpentry_For7_By7_JwtEnc,
    confirm_Carpentry_For7_By4_JwtEnc
before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claim_Carpentry_For0_By0_JwtProm,
    claim_Carpentry_For3_By4_JwtProm,
    confirm_Carpentry_For3_By4_JwtProm,
    confirm_Carpentry_For3_By5_JwtProm,
    confirm_Carpentry_For3_By6_JwtProm,
    claim_Carpentry_For4_By4_JwtProm,
    confirm_Carpentry_For4_By2_JwtProm,
    confirm_Carpentry_For4_By6_JwtProm,
    claim_Carpentry_For7_By7_JwtProm,
    confirm_Carpentry_For7_By4_JwtProm
  ]).then((jwts) => {
    [
      claim_Carpentry_For0_By0_JwtEnc,
      claim_Carpentry_For3_By4_JwtEnc,
      confirm_Carpentry_For3_By4_JwtEnc,
      confirm_Carpentry_For3_By5_JwtEnc,
      confirm_Carpentry_For3_By6_JwtEnc,
      claim_Carpentry_For4_By4_JwtEnc,
      confirm_Carpentry_For4_By2_JwtEnc,
      confirm_Carpentry_For4_By6_JwtEnc,
      claim_Carpentry_For7_By7_JwtEnc,
      confirm_Carpentry_For7_By4_JwtEnc
    ] = jwts
    console.log("Created controller3 user tokens", jwts)
  })

})

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

var claimId
describe('Skills', () => {

  it('insert claim for 0 with carpentry skills by themself', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({jwtEncoded: claim_Carpentry_For0_By0_JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       claimId = r.body
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
  ).timeout(7001)

  it('search reveals no direct connection with "carpentry"', () =>
     request(Server)
     .get('/api/claim?claimContents=carpentry')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       console.log('r.body[0].subject',r.body[0].subject)
       expect(r.body[0].claim.identifier).to.equal(HIDDEN_TEXT)
       expect(r.body[0].claim.identifierVisibleToDids)
         .to.be.an('array')
         .to.include.members([creds[1].did])
       expect(r.body[0].subject).to.equal(HIDDEN_TEXT)
       expect(r.body[0].subjectVisibleToDids)
         .to.be.an('array')
         .to.include.members([creds[1].did])
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('search reveals no personal claim of "carpentry"', () =>
     request(Server)
     .get('/api/claim?claimContents=carpentry&subject=' + creds[2].did)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('search reveals a personal claim of "carpentry"', () =>
     request(Server)
     .get('/api/claim?claimContents=carpentry&subject=' + creds[0].did)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('claim 3 with carpentry skills by 4', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .send({jwtEncoded: claim_Carpentry_For3_By4_JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       claimId = r.body
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
  ).timeout(7001)

  it('claim 7 with carpentry skills by themself', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[7])
     .send({jwtEncoded: claim_Carpentry_For7_By7_JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       claimId = r.body
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
  ).timeout(7001)

  it('confirm 3 with carpentry skills by 4', () => postClaim(4, confirm_Carpentry_For3_By4_JwtEnc)).timeout(7001)
  it('confirm 3 with carpentry skills by 5', () => postClaim(5, confirm_Carpentry_For3_By5_JwtEnc)).timeout(7001)
  it('confirm 3 with carpentry skills by 6', () => postClaim(6, confirm_Carpentry_For3_By6_JwtEnc)).timeout(7001)
  it('claim 4 with carpentry skills by 4', () => postClaim(4, claim_Carpentry_For4_By4_JwtEnc)).timeout(7001)
  it('confirm 4 with carpentry skills by 2', () => postClaim(2, confirm_Carpentry_For4_By2_JwtEnc)).timeout(7001)
  it('confirm 4 with carpentry skills by 6', () => postClaim(6, confirm_Carpentry_For4_By6_JwtEnc)).timeout(7001)
  it('confirm 7 with carpentry skills by 4', () => postClaim(4, confirm_Carpentry_For7_By4_JwtEnc)).timeout(7001)

})
