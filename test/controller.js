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


// Set up some JWTs for calls.
var globalJwt1, globalJwt2
// from https://github.com/uport-project/did-jwt#1-create-a-did-jwt
import didJWT from 'did-jwt'
// This "signer" variable must be named "signer" or you get an error: No Signer functionality has been configured
const signer = didJWT.SimpleSigner('fa09a3ff0d486be2eb69545c393e2cf47cb53feb44a3550199346bdfa6f53245');



var creds = testUtil.creds

let claimBvc = {
  "@context": "http://schema.org",
  "@type": "JoinAction",
  agent: {
    // did: "..."
  },
  event: {
    organizer: { name: "Bountiful Voluntaryist Community" },
    name: "Saturday Morning Meeting",
    startTime: "2018-12-29T08:00:00.000-07:00"
  }
}

let claimMyNight = {
  "@context": "http://schema.org",
  "@type": "JoinAction",
  agent: {
    // did: "..."
  },
  event: {
    organizer: { name: "Me, Myself, and I" },
    name: "Friday night",
    startTime: "2019-01-18T20:00:00.000-07:00"
  }
}

let claimDebug = {
  "@context": "http://schema.org",
  "@type": "JoinAction",
  agent: {
    // did: "..."
  },
  event: {
    organizer: { name: "Trent @ home" },
    name: "Thurs night debug",
    startTime: "2019-02-01T02:00:00Z"
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

let claimFoodPantryFor0 = {
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
}

var credentials = testUtil.credentials

let pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)



let claimBvcFor0 = R.clone(claimBvc)
claimBvcFor0.agent.did = creds[0].did

let claimBvcFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimBvcFor0By0JwtObj.claim = R.clone(claimBvcFor0)
claimBvcFor0By0JwtObj.iss = creds[0].did
claimBvcFor0By0JwtObj.sub = creds[0].did
let claimBvcFor0By0JwtProm = credentials[0].createVerification(claimBvcFor0By0JwtObj)

let confirmBvcFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcFor0By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmBvcFor0By0JwtObj.claim.originalClaims.push(R.clone(claimBvcFor0))
confirmBvcFor0By0JwtObj.iss = creds[1].did
confirmBvcFor0By0JwtObj.sub = creds[0].did
let confirmBvcFor0By0JwtProm = credentials[0].createVerification(confirmBvcFor0By0JwtObj)

let confirmBvcFor0By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcFor0By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmBvcFor0By1JwtObj.claim.originalClaims.push(R.clone(claimBvcFor0))
confirmBvcFor0By1JwtObj.iss = creds[1].did
confirmBvcFor0By1JwtObj.sub = creds[0].did
let confirmBvcFor0By1JwtProm = credentials[1].createVerification(confirmBvcFor0By1JwtObj)



let claimBvcFor1 = R.clone(claimBvc)
claimBvcFor1.agent.did = creds[1].did
claimBvcFor1.event.startTime = "2019-01-13T08:00:00.000-07:00"

let claimBvcFor1By1JwtObj = R.clone(testUtil.jwtTemplate)
claimBvcFor1By1JwtObj.claim = R.clone(claimBvcFor1)
claimBvcFor1By1JwtObj.iss = creds[1].did
claimBvcFor1By1JwtObj.sub = creds[1].did
let claimBvcFor1By1JwtProm = credentials[0].createVerification(claimBvcFor1By1JwtObj)



let claimMyNightFor0 = R.clone(claimMyNight)
claimMyNightFor0.agent.did = creds[0].did

let claimMyNightFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimMyNightFor0By0JwtObj.claim = R.clone(claimMyNightFor0)
claimMyNightFor0By0JwtObj.iss = creds[0].did
claimMyNightFor0By0JwtObj.sub = creds[0].did
let claimMyNightFor0By0JwtProm = credentials[0].createVerification(claimMyNightFor0By0JwtObj)



let claimDebugFor0 = R.clone(claimDebug)
claimDebugFor0.agent.did = creds[0].did

let claimDebugFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimDebugFor0By0JwtObj.claim = R.clone(claimDebugFor0)
claimDebugFor0By0JwtObj.iss = creds[0].did
claimDebugFor0By0JwtObj.sub = creds[0].did
let claimDebugFor0By0JwtProm = credentials[0].createVerification(claimDebugFor0By0JwtObj)



let confirmMultipleFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmMultipleFor0By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmMultipleFor0By0JwtObj.claim.originalClaims.push(R.clone(claimMyNightFor0))
confirmMultipleFor0By0JwtObj.claim.originalClaims.push(R.clone(claimDebugFor0))
confirmMultipleFor0By0JwtObj.iss = creds[0].did
confirmMultipleFor0By0JwtObj.sub = creds[0].did
let confirmMultipleFor0By0JwtProm = credentials[0].createVerification(confirmMultipleFor0By0JwtObj)



let claimCornerBakeryTenureFor0JwtObj = R.clone(testUtil.claimCornerBakery)
claimCornerBakeryTenureFor0JwtObj.party.did = creds[0].did
let claimCornerBakeryTenureFor0Prom = credentials[0].createVerification(claimCornerBakeryTenureFor0JwtObj)

let claimCornerBakeryTenureFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimCornerBakeryTenureFor0By0JwtObj.sub = creds[0].did
claimCornerBakeryTenureFor0By0JwtObj.claim = R.clone(claimCornerBakeryTenureFor0JwtObj)
claimCornerBakeryTenureFor0By0JwtObj.iss = creds[0].did
let claimCornerBakeryTenureFor0By0JwtProm = credentials[0].createVerification(claimCornerBakeryTenureFor0By0JwtObj)

let confirmCornerBakeryTenureFor0By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmCornerBakeryTenureFor0By1JwtObj.sub = creds[0].did
confirmCornerBakeryTenureFor0By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmCornerBakeryTenureFor0By1JwtObj.claim.originalClaims.push(R.clone(claimCornerBakeryTenureFor0JwtObj))
confirmCornerBakeryTenureFor0By1JwtObj.iss = creds[1].did
let confirmCornerBakeryTenureFor0By1JwtProm = credentials[1].createVerification(confirmCornerBakeryTenureFor0By1JwtObj)

let claimIIW2019aFor1 = R.clone(claimIIW2019a)
claimIIW2019aFor1.agent.did = creds[1].did

let claimIIW2019aFor2 = R.clone(claimIIW2019a)
claimIIW2019aFor2.agent.did = creds[2].did

let claimIIW2019aFor1By1JwtObj = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor1By1JwtObj.sub = creds[1].did
claimIIW2019aFor1By1JwtObj.claim = R.clone(claimIIW2019aFor1)
claimIIW2019aFor1By1JwtObj.iss = creds[1].did
let claimIIW2019aFor1By1JwtProm = credentials[1].createVerification(claimIIW2019aFor1By1JwtObj)

let claimIIW2019aFor2By2JwtObj = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor2By2JwtObj.sub = creds[2].did
claimIIW2019aFor2By2JwtObj.claim = R.clone(claimIIW2019aFor2)
claimIIW2019aFor2By2JwtObj.iss = creds[2].did
let claimIIW2019aFor2By2JwtProm = credentials[2].createVerification(claimIIW2019aFor2By2JwtObj)

let confirmIIW2019aFor1By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor1By0JwtObj.sub = creds[1].did
confirmIIW2019aFor1By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor1By0JwtObj.claim.originalClaims.push(R.clone(claimIIW2019aFor1))
confirmIIW2019aFor1By0JwtObj.iss = creds[0].did
let confirmIIW2019aFor1By0JwtProm = credentials[0].createVerification(confirmIIW2019aFor1By0JwtObj)

let confirmIIW2019aFor2By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor2By1JwtObj.sub = creds[2].did
confirmIIW2019aFor2By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor2By1JwtObj.claim.originalClaims.push(R.clone(claimIIW2019aFor2))
confirmIIW2019aFor2By1JwtObj.iss = creds[1].did
let confirmIIW2019aFor2By1JwtProm = credentials[1].createVerification(confirmIIW2019aFor2By1JwtObj)

let claimFoodPantryFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimFoodPantryFor0By0JwtObj.claim = R.clone(claimFoodPantryFor0)
claimFoodPantryFor0By0JwtObj.iss = creds[0].did
claimFoodPantryFor0By0JwtObj.sub = creds[0].did
let claimFoodPantryFor0By0JwtProm = credentials[0].createVerification(claimFoodPantryFor0By0JwtObj)


var pushTokens,
    // claims for 0
    claimBvcFor0By0JwtEnc, confirmBvcFor0By0JwtEnc, confirmBvcFor0By1JwtEnc, claimMyNightFor0By0JwtEnc,
    claimDebugFor0By0JwtEnc, confirmMultipleFor0By0JwtEnc,
    claimCornerBakeryTenureFor0By0JwtEnc, claimFoodPantryFor0By0JwtEnc,
    confirmCornerBakeryTenureFor0By1JwtEnc,
    // claims for 1
    claimBvcFor1By1JwtEnc,
    confirmIIW2019aFor1By0JwtEnc,
    claimIIW2019aFor1By1JwtEnc,
    // claims for 2
    confirmIIW2019aFor2By1JwtEnc,
    claimIIW2019aFor2By2JwtEnc

before(async () => {

  await didJWT.createJWT(
    //did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts
    {aud: 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e', exp: testUtil.tomorrowEpoch, name: 'uPort Developer'},
    {issuer: 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e', signer})
    .then( response => { globalJwt1 = response; console.log("Created global JWT 1", globalJwt1) });

  await didJWT.createJWT(
    {aud: 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761', exp: testUtil.tomorrowEpoch, name: 'uPort Developer'},
    {issuer: 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761', signer})
    .then( response => { globalJwt2 = response; console.log("Created global JWT 2", globalJwt2) });

  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts; console.log("Created controller push tokens", pushTokens) })

  await Promise.all([
    claimBvcFor0By0JwtProm,
    confirmBvcFor0By0JwtProm,
    confirmBvcFor0By1JwtProm,
    claimMyNightFor0By0JwtProm,
    claimBvcFor1By1JwtProm,
    claimDebugFor0By0JwtProm,
    confirmMultipleFor0By0JwtProm,
    claimCornerBakeryTenureFor0By0JwtProm,
    claimFoodPantryFor0By0JwtProm,
    confirmIIW2019aFor1By0JwtProm,
    confirmCornerBakeryTenureFor0By1JwtProm,
    claimIIW2019aFor1By1JwtProm,
    confirmIIW2019aFor2By1JwtProm,
    claimIIW2019aFor2By2JwtProm,
  ]).then((jwts) => {
    claimBvcFor0By0JwtEnc = jwts[0]
    confirmBvcFor0By0JwtEnc = jwts[1]
    confirmBvcFor0By1JwtEnc = jwts[2]
    claimMyNightFor0By0JwtEnc = jwts[3]
    claimBvcFor1By1JwtEnc = jwts[4]
    claimDebugFor0By0JwtEnc = jwts[5]
    confirmMultipleFor0By0JwtEnc = jwts[6]
    claimCornerBakeryTenureFor0By0JwtEnc = jwts[7]
    claimFoodPantryFor0By0JwtEnc = jwts[8]
    confirmIIW2019aFor1By0JwtEnc = jwts[9]
    confirmCornerBakeryTenureFor0By1JwtEnc = jwts[10]
    claimIIW2019aFor1By1JwtEnc = jwts[11]
    confirmIIW2019aFor2By1JwtEnc = jwts[12]
    claimIIW2019aFor2By2JwtEnc = jwts[13]
    console.log("Created controller user tokens", jwts)
  })
})

describe('Util', () => {

  it('should already have a JWT', () => {
    if (!globalJwt1) {
      console.log("Never got the initial JWT created in time, so will stop.")
      console.log("If we can't get past this, we'll have to try a real approach, eg. controller2.js or https://mochajs.org/#delayed-root-suite")
      process.exit(1)
    }
  })

  it('should return the right bbox', () =>
     expect(calcBbox("40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787"))
     .to.be.deep.equal({ westLon:-111.884787 , minLat:40.883944, eastLon:-111.884515, maxLat:40.884088 })
    )

  it('should return the same bbox even in different order', () =>
     expect(calcBbox("40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515"))
     .to.be.deep.equal({ westLon:-111.884787 , minLat:40.883944, eastLon:-111.884515, maxLat:40.884088 })
    )

  it('should test for hidden DIDs', () => {
    expect(testUtil.allDidsAreHidden(null)).to.be.true
    expect(testUtil.allDidsAreHidden(9)).to.be.true
    expect(testUtil.allDidsAreHidden(true)).to.be.true
    expect(testUtil.allDidsAreHidden("stuff")).to.be.true
    expect(testUtil.allDidsAreHidden(HIDDEN_TEXT)).to.be.true
    expect(testUtil.allDidsAreHidden("did:x:0xabc123...")).to.be.false
    expect(testUtil.allDidsAreHidden({a:HIDDEN_TEXT, b:[HIDDEN_TEXT]})).to.be.true
    expect(testUtil.allDidsAreHidden({a:"did:x:0xabc123...", b:[HIDDEN_TEXT]})).to.be.false
    expect(testUtil.allDidsAreHidden(["a", "b", "c", {d: HIDDEN_TEXT}])).to.be.true
    expect(testUtil.allDidsAreHidden(["a", "b", "c", {d: "did:x:0xabc123..."}])).to.be.false
    expect(testUtil.allDidsAreHidden({"did:x:0xabc123...":["a"], b:[HIDDEN_TEXT]})).to.be.false
    let test = {b:[HIDDEN_TEXT]}
    test[HIDDEN_TEXT] = ["a"]
    expect(testUtil.allDidsAreHidden(test)).to.be.true
  })

  it('should hide DIDs', () => {
    let addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    let addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    let addra = 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761'
    let addrd = 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e'
    let addru = 'did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts'
    var someObj1 = {a: 1, b: addr0,       c: {d: addr6,       e: [], f: [9, {g: addru}]}}
    var repObj11 = {a: 1, b: HIDDEN_TEXT, c: {d: HIDDEN_TEXT, e: [], f: [9, {g: HIDDEN_TEXT}]}}
    var repObj12 = {a: 1, b: addr0,       c: {d: HIDDEN_TEXT, e: [], f: [9, {g: addru}]}}
    var someObj2 = {a: 1, b: 2}
    someObj2[addr0] = 9
    var allowedDids

    allowedDids = []
    expect(hideDids(allowedDids, null)).to.be.equal(null)
    expect(hideDids(allowedDids, 9)).to.be.equal(9)
    expect(hideDids(allowedDids, false)).to.be.equal(false)
    expect(hideDids(allowedDids, "Some random randomness")).to.be.equal("Some random randomness")
    expect(hideDids(allowedDids, addru)).to.be.equal(HIDDEN_TEXT)
    expect(hideDids(allowedDids, {})).to.be.deep.equal({})
    expect(hideDids(allowedDids, someObj1)).to.be.deep.equal(repObj11)
    expect(hideDids(allowedDids, [])).to.be.deep.equal([])
    expect(hideDids(allowedDids, [someObj1])).to.be.deep.equal([repObj11])
    expect(() => hideDids(allowedDids, someObj2)).to.throw()

    allowedDids = [addrd]
    expect(hideDids(allowedDids, addrd)).to.be.deep.equal(addrd)
    expect(hideDids(allowedDids, addru)).to.be.deep.equal(HIDDEN_TEXT)

    allowedDids = [addr0, addrd, addru]
    expect(hideDids(allowedDids, addr0)).to.be.deep.equal(addr0)
    expect(hideDids(allowedDids, addra)).to.be.deep.equal(HIDDEN_TEXT)
    expect(hideDids(allowedDids, someObj1)).to.be.deep.equal(repObj12)
    expect(() => hideDids(allowedDids, someObj2)).to.throw()
  })

  it('should get a sorted object', () =>
     request(Server)
     .get('/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"c":\{"cb":2,"ca":1\},"a":4\}')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(JSON.stringify(r.body))
         .to.deep.equal('{"a":4,"b":[5,1,2,3,{"ba":1,"bb":2,"bc":3}],"c":{"ca":1,"cb":2}}')
     }))

})

var firstId

describe('Claim', () => {

  it('should get no claims', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     })).timeout(7001) // these 7001 & 6001 waits were added after JWT verify was added

  it('should get a 404, missing invalid claim number', () =>
     request(Server)
     .get('/api/claim/999')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .then(r => {
       expect(400)
       expect(r.status).that.equals(404)
     })).timeout(7001)

  it('should add a new action claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimBvcFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       firstId = r.body
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should get a claim #1', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals(creds[0].did)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get a claim with the DID hidden', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt2)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals(HIDDEN_TEXT)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should add a confirmation for that action', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmBvcFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 1)
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should get 3 claims', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get 1 JoinAction claim', () =>
     request(Server)
     .get('/api/claim?claimType=JoinAction')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get 1 comfirmation', () =>
     request(Server)
     .get('/api/claim?claimType=Confirmation')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should add another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimMyNightFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 2)
       expect(r.status).that.equals(201)
     })).timeout(6002)

  it('should add yet another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimBvcFor1By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 3)
       expect(r.status).that.equals(201)
     })).timeout(7500)

  it('should add another new confirmation', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": confirmBvcFor0By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 4)
       expect(r.status).that.equals(201)
     })).timeout(6002)

  it('should add a new join claim for a debug event (Trent @ home, Thurs night debug, 2019-02-01T02:00:00Z)', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimDebugFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 5)
       expect(r.status).that.equals(201)
     })).timeout(6002)


  it('should add another new confirmation of two claims', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmMultipleFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 6)
       expect(r.status).that.equals(201)
     })).timeout(6002)

})

describe('Action', () => {

  it('should get action with the right properties', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       console.log("r.body",r.body)
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(r.body)
         .that.has.property('jwtId')
         .that.equals(firstId)
       expect(r.body)
         .that.has.property('eventId')
         .that.equals(firstId)
       expect(r.body)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(r.body)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get complaint about a missing JWT', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .that.equals("Missing JWT In " + UPORT_PUSH_TOKEN_HEADER)
       expect(400)
       expect(r.status).that.equals(401)
     }))


  it('should get action with the DID hidden', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt2)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals(HIDDEN_TEXT)
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get no actions that match query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T14:59:59Z')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get one action that matched query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T15:00:00Z')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       let action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(action1)
         .that.has.property('eventId')
         .that.equals(firstId)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get enough past claims', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + DAY_START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(4)
       let action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(action1)
         .that.has.property('eventId')
         .that.equals(firstId + 3)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Trent @ home')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Thurs night debug')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2019-02-01 02:00:00')
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get no claims today', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + TODAY_START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})

describe('Event', () => {

  it('should get event with the right properties', () =>
     request(Server)
     .get('/api/event/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('orgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(r.body)
         .that.has.property('name')
         .that.equals('Saturday Morning Meeting')
       expect(r.body)
         .that.has.property('startTime')
         .that.equals('2018-12-29 15:00:00')
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get 1 event', () =>
     request(Server)
     .get('/api/event?orgName=Bountiful%20Voluntaryist%20Community')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get a set of action claims & confirmations', () =>
     request(Server)
     .get('/api/event/1/actionClaimsAndConfirmations')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('action')
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('confirmations')
         .that.has.property(0)
         .that.has.property('issuer')
         .that.equals(creds[0].did)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('confirmations')
         .that.has.property(1)
         .that.has.property('issuer')
         .that.equals(creds[1].did)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})

describe('Tenure', () => {

  it ('should create a tenure', () =>
      request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
      .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTUyNTgyODMsImV4cCI6MTU1NTM0NDY4Mywic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IlRlbnVyZSIsInNwYXRpYWxVbml0Ijp7ImdlbyI6eyJAdHlwZSI6Ikdlb1NoYXBlIiwicG9seWdvbiI6IjQwLjg4Mzk0NCwtMTExLjg4NDc4NyA0MC44ODQwODgsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0NTE1IDQwLjg4Mzk0NCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ3ODcifX0sInBhcnR5Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.g7jKukK9a2NAf2AHrrtQLNWePmkU1iLya1EFUdRxvk18zNJBFdHF77YoZMhz5VAW4cIgaUhnzVqNgVrXLc7RSAE"})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.a('number')
          .that.equals(firstId + 7)
        expect(r.status).that.equals(201)
      })).timeout(6000)

  it('should get 1 claim', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})

describe('Report', () => {

  it('should get right aggregated info', () =>
     request(Server)
     .get('/api/report/actionClaimsAndConfirmationsSince?dateTime=' + START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('did')
       expect(r.body[0].did)
         .to.be.a('string')
         .that.is.equal(creds[0].did)
       let df0Index =
           R.findIndex(R.whereEq({did: creds[0].did}))(r.body)
       let df0Claims = r.body[df0Index].actions
       expect(df0Claims)
         .to.be.an('array')
         .of.length(3)
       expect(df0Claims[0].confirmations)
         .to.be.an('array')
         .of.length(2)
       expect(r.body[1].did)
         .to.be.an('string')
         .that.is.equal(creds[1].did)
       expect(r.body[1].actions)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get 1 tenure', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get no tenures', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883943&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})


describe('Visibility utils', () => {

  it('should get claims from other tests but cannot see inside any', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array')
       for (var i = 0; i < r.body.length; i++) {
         expect(testUtil.allDidsAreHidden(r.body[i])).to.be.true
       }
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should create a new tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({ "jwtEncoded": claimCornerBakeryTenureFor0By0JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should get claims and can see inside the most recent one', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array')
       expect(testUtil.allDidsAreHidden(r.body[0])).to.be.false
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should confirm that competing tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({ "jwtEncoded": confirmCornerBakeryTenureFor0By1JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should get 2 tenure claims', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(7001)

  it('should get 2 competing tenures and confirmations', () =>
     request(Server)
     .get('/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(7001)

})

describe('Transitive Connections', () => {

  it('should claim attendance for 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": claimIIW2019aFor1By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should claim attendance for 2', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({"jwtEncoded": claimIIW2019aFor2By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should confirm attendance for 1 by 0', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmIIW2019aFor1By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

  it('should confirm attendance for 2 by 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": confirmIIW2019aFor2By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('number')
       expect(r.status).that.equals(201)
     })).timeout(7001)

})
