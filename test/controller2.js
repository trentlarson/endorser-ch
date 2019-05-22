import chai from 'chai'
import request from 'supertest'
import R from 'ramda'

import Server from '../server'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util'
import testUtil from './util'

const expect = chai.expect

// from https://developer.uport.space/uport-credentials/reference/index and https://developer.uport.space/credentials/transactions
const { Credentials } = require('uport-credentials')
// from Credentials.createIdentity();

var creds = testUtil.creds

var credentials = R.map((c) => new Credentials(c), creds)

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let claimIIW2019a = {
  "@context": "http://schema.org",
  "@type": "JoinAction",
  "agent": {
    // supply "did"
  },
  "event": {
    "organizer": {
      "name": "Internet Identity Workshop"
    },
    "name": "The Internet Identity Workshop XXVIII (#28)",
    "startTime": "2019-04-30T08:00:00.000-07:00"
  }
}

let claimFoodPantryFor0By0Jwt =
{
  "iat": testUtil.nowEpoch,
  "exp": testUtil.tomorrowEpoch,
  "sub": creds[0].did,
  "claim": {
    "@context": "http://endorser.ch",
    "@type": "Tenure",
    "spatialUnit": {
      "geo": {
        "@type": "GeoShape",
        "polygon": "40.890431,-111.870292 40.890425,-111.869691 40.890867,-111.869654 40.890890-111.870295 40.890431-111.870292"
      }
    },
    "party": {
      "did": creds[0].did
    }
  },
  "iss": creds[0].did
}

let claimCornerBakeryTenureFor0 = R.clone(testUtil.claimCornerBakery)
claimCornerBakeryTenureFor0.party.did = creds[0].did

let claimCornerBakeryTenureFor0By0Jwt = R.clone(testUtil.jwtTemplate)
claimCornerBakeryTenureFor0By0Jwt.sub = creds[0].did
claimCornerBakeryTenureFor0By0Jwt.claim = R.clone(claimCornerBakeryTenureFor0)
claimCornerBakeryTenureFor0By0Jwt.iss = creds[0].did

let confirmCornerBakeryTenureFor0By1Jwt = R.clone(testUtil.jwtTemplate)
confirmCornerBakeryTenureFor0By1Jwt.sub = creds[0].did
confirmCornerBakeryTenureFor0By1Jwt.claim = R.clone(testUtil.confirmationTemplate)
confirmCornerBakeryTenureFor0By1Jwt.claim.originalClaims.push(R.clone(claimCornerBakeryTenureFor0))
confirmCornerBakeryTenureFor0By1Jwt.iss = creds[1].did

let claimIIW2019aFor1 = R.clone(claimIIW2019a)
claimIIW2019aFor1.agent.did = creds[1].did

let claimIIW2019aFor2 = R.clone(claimIIW2019a)
claimIIW2019aFor2.agent.did = creds[2].did

let claimIIW2019aFor1By1Jwt = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor1By1Jwt.sub = creds[1].did
claimIIW2019aFor1By1Jwt.claim = R.clone(claimIIW2019aFor1)
claimIIW2019aFor1By1Jwt.iss = creds[1].did

let claimIIW2019aFor2By2Jwt = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor2By2Jwt.sub = creds[2].did
claimIIW2019aFor2By2Jwt.claim = R.clone(claimIIW2019aFor2)
claimIIW2019aFor2By2Jwt.iss = creds[2].did

let confirmIIW2019aFor1By0Jwt = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor1By0Jwt.sub = creds[1].did
confirmIIW2019aFor1By0Jwt.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor1By0Jwt.claim.originalClaims.push(R.clone(claimIIW2019aFor1))
confirmIIW2019aFor1By0Jwt.iss = creds[0].did

let confirmIIW2019aFor2By1Jwt = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor2By1Jwt.sub = creds[2].did
confirmIIW2019aFor2By1Jwt.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor2By1Jwt.claim.originalClaims.push(R.clone(claimIIW2019aFor2))
confirmIIW2019aFor2By1Jwt.iss = creds[1].did

let user0TokenProms =
    R.map((c) => credentials[0].createVerification(c),
          [claimCornerBakeryTenureFor0By0Jwt, claimFoodPantryFor0By0Jwt, confirmIIW2019aFor1By0Jwt])

let user1TokenProms =
    R.map((c) => credentials[0].createVerification(c),
          [confirmCornerBakeryTenureFor0By1Jwt, claimIIW2019aFor1By1Jwt, confirmIIW2019aFor2By1Jwt])

let user2TokenProms =
    R.map((c) => credentials[0].createVerification(c),
          [claimIIW2019aFor2By2Jwt])

var pushTokens, user0Tokens, user1Tokens, user2Tokens
before(async () => {
  await Promise.all(pushTokenProms).then((allJwts) => { pushTokens = allJwts })
  console.log("Created controller2 push tokens", pushTokens)

  await Promise.all(user0TokenProms).then((jwts) => { user0Tokens = jwts })
  console.log("Created controller2 user 0 tokens", user0Tokens)

  await Promise.all(user1TokenProms).then((jwts) => { user1Tokens = jwts })
  console.log("Created controller2 user 1 tokens", user1Tokens)

  await Promise.all(user2TokenProms).then((jwts) => { user2Tokens = jwts })
  console.log("Created controller2 user 2 tokens", user2Tokens)
})

describe('Tenure 2: Competing Tenure Claim', () => {

  it('should get claims from other tests but cannot see inside any', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
       for (var i = 0; i < r.body.length; i++) {
         expect(testUtil.allDidsAreHidden(r.body[i]))
           .to.be.true
       }
     })).timeout(7001)

  it('should create a new tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({ "jwtEncoded": user0Tokens[0] })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

  it('should get claims and can see inside the most recent one', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
       expect(testUtil.allDidsAreHidden(r.body[0]))
         .to.be.false
     })).timeout(7001)

  it('should confirm that competing tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({ "jwtEncoded": user1Tokens[0] })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

  it('should get 2 tenure claims', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     })).timeout(7001)

  it('should get 2 competing tenures and confirmations', () =>
     request(Server)
     .get('/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     })).timeout(7001)

})

describe('Transitive Connections', () => {

  it('should claim attendance for 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": user1Tokens[1]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

  it('should claim attendance for 2', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({"jwtEncoded": user2Tokens[0]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

  it('should confirm attendance for 1 by 0', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": user0Tokens[2]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

  it('should confirm attendance for 2 by 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": user1Tokens[2]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(201)
       expect(r.body)
         .to.be.a('number')
     })).timeout(7001)

})
