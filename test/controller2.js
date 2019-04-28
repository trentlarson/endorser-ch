import chai from 'chai'
import request from 'supertest'
import R from 'ramda'

import Server from '../server'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util'
import { allDidsAreHidden } from './util'

const expect = chai.expect

// from https://developer.uport.space/uport-credentials/reference/index and https://developer.uport.space/credentials/transactions
const { Credentials } = require('uport-credentials')
// from Credentials.createIdentity();
var creds = [
  { did: 'did:ethr:0x0e1caa561c163793d91f341c806fab4a7a424056', privateKey: '0fb8231512c9edc5b9603a628f5b11836b97b313f4e6b3e8335e66f546c9364c' },
  { did: 'did:ethr:0x11f49dbec23864aa0ff1a36af72807a0e3b20b76', privateKey: '069a375bad04b638aed5895a12d103ea57bbf19616d4add0b0ba3bf634044681' },
  { did: 'did:ethr:0x275cee0e4657075d3b9564940fe39194e9cedceb', privateKey: '923035e1d86a95d11859be1e8c8657aa1725edfaab1792faedcc94d82467b57c' },
  { did: 'did:ethr:0x36d39b6f92f2fccdb5067e8b11154d906caf44cc', privateKey: '1866028146a25960e0a48e363c127765ace5c4e340c4bbcf35f4524a5f04f24a' },
]

var credentials = R.map((c) => new Credentials(c), creds)

let nowEpoch = Math.floor(new Date().getTime() / 1000)
let tomorrowEpoch = nowEpoch + (24 * 60 * 60)

let pushTokenProms = R.map((c) => c.createVerification({ exp: tomorrowEpoch }), credentials)

let tenureFor0AtFoodPantry =
{
  "iat": nowEpoch,
  "exp": tomorrowEpoch,
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

let tenureFor0AtCornerBakery =
    {
      "iat": nowEpoch,
      "exp": tomorrowEpoch,
      "sub": creds[0].did,
      "claim": {
        "@context": "http://endorser.ch",
        "@type": "Tenure",
        "spatialUnit": {
          "geo": {
            "@type": "GeoShape",
            "polygon": "40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787"
          }
        },
        "party": {
          "did": creds[0].did
        }
      },
      "iss": creds[0].did
    }

let user0TokenProms = R.map((c) => credentials[0].createVerification(c), [tenureFor0AtFoodPantry, tenureFor0AtCornerBakery])

var pushTokens, user0Tokens
before(async () => {
  await Promise.all(pushTokenProms).then((allJwts) => { pushTokens = allJwts })
  console.log("Created controller2 push tokens", pushTokens)
  await Promise.all(user0TokenProms).then((jwts) => { user0Tokens = jwts })
  console.log("Created controller2 user 0 tokens", user0Tokens)
})

describe('Test Claim DID Visibility', () => {

  it('should get claims from other tests but cannot see inside any', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
       for (var i = 0; i < r.body.length; i++) {
         expect(allDidsAreHidden(r.body[i]))
           .to.be.true
       }
     })).timeout(5001)

  it('should create a new tenure', () =>
      request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({ "jwtEncoded": user0Tokens[0] })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.a('number')
      })).timeout(5001)

  it('should get claims and can see inside the most recent one', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
       expect(allDidsAreHidden(r.body[0]))
         .to.be.false
     })).timeout(5001)

  it('should get 2 tenure claims', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     })).timeout(5001)

})

describe('Tenure 2: Competing Tenure Claims', () => {

  it('should create a new tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({ "jwtEncoded": user0Tokens[1] })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
     })).timeout(5001)

  it('should get 3 tenure claims', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(3)
     })).timeout(5001)

  it('should get 2 competing tenures and confirmations', () =>
     request(Server)
     .get('/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     })).timeout(5001)

})
