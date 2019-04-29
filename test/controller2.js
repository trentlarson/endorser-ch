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
  { did: 'did:ethr:0x00c9c2326c73f73380e8402b01de9defcff2b064', privateKey: '8de6e2bd938a29a8348316cbae3811475f22f2ae87a42ad0ece727ff25c613b5' },
  { did: 'did:ethr:0x11bb3621f8ea471a750870ae8dd5f4b8203e9557', privateKey: 'e4a3d47ed1058e5c07ed825b5cf0516aab757b1d141a4dc24392271537e10aa0' },
  { did: 'did:ethr:0x22c51a43844e44b59c112cf74f3f5797a057837a', privateKey: '590e1a75d89e453d9b33f982badc4fdcd67046c8dbf4323f367b847776126d1b' },
  { did: 'did:ethr:0x332661e9e6af65eea6df253296a26257ff304647', privateKey: 'ae945c106dc5538b5dc6acffef7901ef5e30b22c80d7af0a5d466432a49eeb9c' },
  { did: 'did:ethr:0x44afb67bb333f2f61aa160532de0490f6dc9f441', privateKey: 'c729c12f5b95db8ab048b95319329f35e9165585a3e9f69f36e7309f2f1c77bc' },
  { did: 'did:ethr:0x5592ea1a9a3c9bb12abe5fc91bfa40622b24a932', privateKey: '3561bed03fb41bf3dec3926273b302f20bb25a25c723a93e1e6c9212edff6d1d' },
  { did: 'did:ethr:0x66b50b886a7df641c96f787002de3ace753bb1b1', privateKey: '7bd14ba3709d0d31f8ba56f211856bdb021655c5d99aa5ef055e875159e695a6' },
  { did: 'did:ethr:0x777d6361330d047e99bee0a275a8adb908fe5514', privateKey: 'e078084054c30a94f648cfde5bc1bbcbc341ee71431f1b37abf1dc7c8f2f5d35' },
]

var credentials = R.map((c) => new Credentials(c), creds)

let nowEpoch = Math.floor(new Date().getTime() / 1000)
let tomorrowEpoch = nowEpoch + (24 * 60 * 60)

let pushTokenProms = R.map((c) => c.createVerification({ exp: tomorrowEpoch }), credentials)

let jwtTemplate = {
  "iat": nowEpoch,
  "exp": tomorrowEpoch,
  // supply "sub"
  // supply "claim", usually including same DID of "sub"
  // supply "iss"
}

let confirmationTemplate = {
  "@context": "http://endorser.ch",
  "@type": "Confirmation",
  "originalClaims": [
    // supply claims
  ]
}

let claimCornerBakery = {
  "@context": "http://endorser.ch",
  "@type": "Tenure",
  "spatialUnit": {
    "geo": {
      "@type": "GeoShape",
      "polygon": "40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787"
    }
  },
  "party": {
    // supply "did"
  }
}

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

let claimCornerBakeryTenureFor0 = R.clone(claimCornerBakery)
claimCornerBakeryTenureFor0.party.did = creds[0].did

let claimCornerBakeryTenureFor0By0Jwt = R.clone(jwtTemplate)
claimCornerBakeryTenureFor0By0Jwt.sub = creds[0].did
claimCornerBakeryTenureFor0By0Jwt.claim = R.clone(claimCornerBakeryTenureFor0)
claimCornerBakeryTenureFor0By0Jwt.iss = creds[0].did

let confirmCornerBakeryTenureFor0By1Jwt = R.clone(jwtTemplate)
confirmCornerBakeryTenureFor0By1Jwt.sub = creds[0].did
confirmCornerBakeryTenureFor0By1Jwt.claim = R.clone(confirmationTemplate)
confirmCornerBakeryTenureFor0By1Jwt.claim.originalClaims.push(R.clone(claimCornerBakeryTenureFor0))
confirmCornerBakeryTenureFor0By1Jwt.iss = creds[1].did

let claimIIW2019aFor1 = R.clone(claimIIW2019a)
claimIIW2019aFor1.agent.did = creds[1].did

let claimIIW2019aFor2 = R.clone(claimIIW2019a)
claimIIW2019aFor2.agent.did = creds[2].did

let claimIIW2019aFor1By1Jwt = R.clone(jwtTemplate)
claimIIW2019aFor1By1Jwt.sub = creds[1].did
claimIIW2019aFor1By1Jwt.claim = R.clone(claimIIW2019aFor1)
claimIIW2019aFor1By1Jwt.iss = creds[1].did

let claimIIW2019aFor2By2Jwt = R.clone(jwtTemplate)
claimIIW2019aFor2By2Jwt.sub = creds[2].did
claimIIW2019aFor2By2Jwt.claim = R.clone(claimIIW2019aFor2)
claimIIW2019aFor2By2Jwt.iss = creds[2].did

let confirmIIW2019aFor1By0Jwt = R.clone(jwtTemplate)
confirmIIW2019aFor1By0Jwt.sub = creds[1].did
confirmIIW2019aFor1By0Jwt.claim = R.clone(confirmationTemplate)
confirmIIW2019aFor1By0Jwt.claim.originalClaims.push(R.clone(claimIIW2019aFor1))
confirmIIW2019aFor1By0Jwt.iss = creds[0].did

let confirmIIW2019aFor2By1Jwt = R.clone(jwtTemplate)
confirmIIW2019aFor2By1Jwt.sub = creds[2].did
confirmIIW2019aFor2By1Jwt.claim = R.clone(confirmationTemplate)
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

  it('should confirm that competing tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({ "jwtEncoded": user1Tokens[0] })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
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

describe('Transitive Connections', () => {

  it('should claim attendance for 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": user1Tokens[1]})
     .expect('Content-Type', /json/)
     .then(r => {
       console.log("result from claim", r.body)
       expect(r.body)
         .to.be.a('number')
     })).timeout(5001)

  it('should claim attendance for 2', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({"jwtEncoded": user2Tokens[0]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
     })).timeout(5001)

  it('should confirm attendance for 1 by 0', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": user0Tokens[2]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
     })).timeout(5001)

  it('should confirm attendance for 2 by 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": user1Tokens[2]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
     })).timeout(5001)

})
