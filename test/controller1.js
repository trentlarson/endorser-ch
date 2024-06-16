
// Tests for utils, initial claims, actions, events, tenures, other reports, and visibility in connections

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import chaiString from 'chai-string'
import crypto from 'crypto'
import { createJWT } from 'did-jwt'
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'

const { Credentials } = require('uport-credentials')

import Server from '../server'
import { allDidsInside, calcBbox, claimHashChain, HIDDEN_TEXT, nonceHashChain, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import { hideDidsAndAddLinksToNetworkSub } from '../server/api/services/util-higher';
import testUtil from './util'

chai.use(chaiAsPromised)
chai.use(chaiString)
const expect = chai.expect

const START_TIME_STRING = '2018-12-29T08:00:00.000-07:00'
const DAY_START_TIME_STRING = DateTime.fromISO(START_TIME_STRING).set({hour:0}).startOf("day").toISO()
const TODAY_START_TIME_STRING = DateTime.local().set({hour:0}).startOf("day").toISO()


/**
// Set up some JWTs for calls.
// from https://github.com/uport-project/did-jwt#1-create-a-did-jwt
// ... but now disabled because this no longer passes JWT verification.
import didJWT from 'did-jwt'
// This "signer" variable must be named "signer" or you get an error: No Signer functionality has been configured
const signer = didJWT.SimpleSigner('fa09a3ff0d486be2eb69545c393e2cf47cb53feb44a3550199346bdfa6f53245');
**/


const creds = testUtil.credData

const claimBvc = {
  "@context": "https://schema.org",
  "@type": "JoinAction",
  agent: {
    // identifier: "..."
  },
  event: {
    organizer: { name: "Bountiful Voluntaryist Community" },
    name: "Saturday Morning Meeting",
    startTime: "2018-12-29T08:00:00.000-07:00"
  }
}

const claimMyNight = {
  "@context": "https://schema.org",
  "@type": "JoinAction",
  agent: {
    // identifier: "..."
  },
  event: {
    organizer: { name: "Me, Myself, and I" },
    name: "Friday night",
    startTime: "2019-01-18T20:00:00.000-07:00"
  }
}

const claimDebug = {
  "@context": "https://schema.org",
  "@type": "JoinAction",
  agent: {
    // identifier: "..."
  },
  event: {
    organizer: { name: "Trent @ home" },
    name: "Thurs night debug",
    startTime: "2019-02-01T02:00:00Z"
  }
}

const claimIIW2019a = {
  "@context": "https://schema.org",
  "@type": "JoinAction",
  "agent": {
    // supply "identifier"
  },
  "event": {
    "organizer": {
      "name": "Internet Identity Workshop"
    },
    "name": "The Internet Identity Workshop XXVIII (#28)",
    "startTime": "2019-04-30T08:00:00.000-07:00"
  }
}

const credentials = testUtil.credentials

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const registerBy0Proms =
  R.times(
    num => {
      const registerBy0JwtObj = R.clone(testUtil.jwtTemplate)
      registerBy0JwtObj.claim = R.clone(testUtil.registrationTemplate)
      registerBy0JwtObj.claim.agent.identifier = creds[0].did
      registerBy0JwtObj.claim.participant.identifier = creds[num].did
      registerBy0JwtObj.sub = creds[num].did
      return credentials[0].createVerification(registerBy0JwtObj)
    },
    16
  )




const claimBvcFor0 = R.clone(claimBvc)
claimBvcFor0.agent.identifier = creds[0].did

const claimBvcFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimBvcFor0By0JwtObj.claim = R.clone(claimBvcFor0)
claimBvcFor0By0JwtObj.sub = creds[0].did
const claimBvcFor0By0JwtProm = credentials[0].createVerification(claimBvcFor0By0JwtObj) // adds iss & exp

const confirmBvcFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcFor0By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmBvcFor0By0JwtObj.claim.object.push(R.clone(claimBvcFor0))
confirmBvcFor0By0JwtObj.sub = creds[0].did
const confirmBvcFor0By0JwtProm = credentials[0].createVerification(confirmBvcFor0By0JwtObj)

const confirmBvcFor0By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcFor0By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmBvcFor0By1JwtObj.claim.object.push(R.clone(claimBvcFor0))
confirmBvcFor0By1JwtObj.sub = creds[0].did
const confirmBvcFor0By1JwtProm = credentials[1].createVerification(confirmBvcFor0By1JwtObj)

const confirmBvcFor0By3JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcFor0By3JwtObj.claim = R.clone(testUtil.confirmationTemplate)
// This is different: the embedded claim won't duplicate '@context'.
const embeddedClaimBvcFor0 = R.clone(claimBvcFor0)
delete embeddedClaimBvcFor0['@context']
confirmBvcFor0By3JwtObj.claim.object.push(embeddedClaimBvcFor0)
confirmBvcFor0By3JwtObj.sub = creds[0].did
const confirmBvcFor0By3JwtProm = credentials[3].createVerification(confirmBvcFor0By3JwtObj)

const confirmBvcForConfirm0By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmBvcForConfirm0By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmBvcForConfirm0By1JwtObj.claim.object.push(R.clone(confirmBvcFor0By0JwtObj.claim))
confirmBvcForConfirm0By1JwtObj.sub = creds[0].did
const confirmBvcForConfirm0By1JwtProm = credentials[1].createVerification(confirmBvcForConfirm0By1JwtObj)




const claimBvcFor1 = R.clone(claimBvc)
claimBvcFor1.agent.identifier = creds[1].did
claimBvcFor1.event.startTime = "2019-01-13T08:00:00.000-07:00"

const claimBvcFor1By1JwtObj = R.clone(testUtil.jwtTemplate)
claimBvcFor1By1JwtObj.claim = R.clone(claimBvcFor1)
claimBvcFor1By1JwtObj.sub = creds[1].did
const claimBvcFor1By1JwtProm = credentials[0].createVerification(claimBvcFor1By1JwtObj)




const claimMyNightFor0 = R.clone(claimMyNight)
claimMyNightFor0.agent.identifier = creds[0].did

const claimMyNightFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimMyNightFor0By0JwtObj.claim = R.clone(claimMyNightFor0)
claimMyNightFor0By0JwtObj.sub = creds[0].did
const claimMyNightFor0By0JwtProm = credentials[0].createVerification(claimMyNightFor0By0JwtObj)



const claimDebugFor0 = R.clone(claimDebug)
claimDebugFor0.agent.identifier = creds[0].did

const claimDebugFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
claimDebugFor0By0JwtObj.claim = R.clone(claimDebugFor0)
claimDebugFor0By0JwtObj.sub = creds[0].did
const claimDebugFor0By0JwtProm = credentials[0].createVerification(claimDebugFor0By0JwtObj)



const confirmMultipleFor0By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmMultipleFor0By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmMultipleFor0By0JwtObj.claim.object.push(R.clone(claimMyNightFor0))
confirmMultipleFor0By0JwtObj.claim.object.push(R.clone(claimDebugFor0))
confirmMultipleFor0By0JwtObj.sub = creds[0].did
const confirmMultipleFor0By0JwtProm = credentials[0].createVerification(confirmMultipleFor0By0JwtObj)



const claimCornerBakeryTenureFor11 = R.clone(testUtil.claimCornerBakery)
claimCornerBakeryTenureFor11.party.identifier = creds[11].did

const claimCornerBakeryTenureFor11By11JwtObj = R.clone(testUtil.jwtTemplate)
claimCornerBakeryTenureFor11By11JwtObj.claim = R.clone(claimCornerBakeryTenureFor11)
claimCornerBakeryTenureFor11By11JwtObj.sub = creds[11].did
const claimCornerBakeryTenureFor11By11JwtProm = credentials[11].createVerification(claimCornerBakeryTenureFor11By11JwtObj)

const claimCornerBakeryTenureFor12 = R.clone(testUtil.claimCornerBakery)
claimCornerBakeryTenureFor12.party.identifier = creds[12].did

const claimCornerBakeryTenureFor12By12JwtObj = R.clone(testUtil.jwtTemplate)
claimCornerBakeryTenureFor12By12JwtObj.claim = R.clone(claimCornerBakeryTenureFor12)
claimCornerBakeryTenureFor12By12JwtObj.sub = creds[12].did
const claimCornerBakeryTenureFor12By12JwtProm = credentials[12].createVerification(claimCornerBakeryTenureFor12By12JwtObj)

const confirmCornerBakeryTenureFor11By10JwtObj = R.clone(testUtil.jwtTemplate)
confirmCornerBakeryTenureFor11By10JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmCornerBakeryTenureFor11By10JwtObj.claim.object.push(R.clone(claimCornerBakeryTenureFor11))
confirmCornerBakeryTenureFor11By10JwtObj.sub = creds[11].did
const confirmCornerBakeryTenureFor11By10JwtProm = credentials[10].createVerification(confirmCornerBakeryTenureFor11By10JwtObj)

const claimIIW2019aFor1 = R.clone(claimIIW2019a)
claimIIW2019aFor1.agent.identifier = creds[1].did

const claimIIW2019aFor2 = R.clone(claimIIW2019a)
claimIIW2019aFor2.agent.identifier = creds[2].did

const claimIIW2019aFor1By1JwtObj = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor1By1JwtObj.claim = R.clone(claimIIW2019aFor1)
claimIIW2019aFor1By1JwtObj.sub = creds[1].did
const claimIIW2019aFor1By1JwtProm = credentials[1].createVerification(claimIIW2019aFor1By1JwtObj)

const claimIIW2019aFor2By2JwtObj = R.clone(testUtil.jwtTemplate)
claimIIW2019aFor2By2JwtObj.claim = R.clone(claimIIW2019aFor2)
claimIIW2019aFor2By2JwtObj.sub = creds[2].did
const claimIIW2019aFor2By2JwtProm = credentials[2].createVerification(claimIIW2019aFor2By2JwtObj)

const confirmIIW2019aFor1By0JwtObj = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor1By0JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor1By0JwtObj.claim.object.push(R.clone(claimIIW2019aFor1))
confirmIIW2019aFor1By0JwtObj.sub = creds[1].did
const confirmIIW2019aFor1By0JwtProm = credentials[0].createVerification(confirmIIW2019aFor1By0JwtObj)

const confirmIIW2019aFor2By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmIIW2019aFor2By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmIIW2019aFor2By1JwtObj.claim.object.push(R.clone(claimIIW2019aFor2))
confirmIIW2019aFor2By1JwtObj.sub = creds[2].did
const confirmIIW2019aFor2By1JwtProm = credentials[1].createVerification(confirmIIW2019aFor2By1JwtObj)




const claimFoodPantryFor4 = R.clone(testUtil.claimFoodPantry)
claimFoodPantryFor4.party.identifier = creds[4].did

const claimFoodPantryFor4By4JwtObj = R.clone(testUtil.jwtTemplate)
claimFoodPantryFor4By4JwtObj.claim = R.clone(claimFoodPantryFor4)
claimFoodPantryFor4By4JwtObj.sub = creds[4].did
const claimFoodPantryFor4By4JwtProm = credentials[4].createVerification(claimFoodPantryFor4By4JwtObj)

const confirmFoodPantryFor4By1JwtObj = R.clone(testUtil.jwtTemplate)
confirmFoodPantryFor4By1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmFoodPantryFor4By1JwtObj.claim.object.push(R.clone(claimFoodPantryFor4))
confirmFoodPantryFor4By1JwtObj.sub = creds[4].did
const confirmFoodPantryFor4By1JwtProm = credentials[1].createVerification(confirmFoodPantryFor4By1JwtObj)

const confirmFoodPantryFor4By2JwtObj = R.clone(testUtil.jwtTemplate)
confirmFoodPantryFor4By2JwtObj.claim = R.clone(testUtil.confirmationTemplate)
confirmFoodPantryFor4By2JwtObj.claim.object.push(R.clone(claimFoodPantryFor4))
confirmFoodPantryFor4By2JwtObj.sub = creds[4].did
const confirmFoodPantryFor4By2JwtProm = credentials[2].createVerification(confirmFoodPantryFor4By2JwtObj)




let pushTokens, registerBy0JwtEncs,
    // claims for 0
    claimBvcFor0By0JwtEnc, confirmBvcFor0By0JwtEnc, confirmBvcFor0By1JwtEnc, confirmBvcFor0By3JwtEnc,
    claimMyNightFor0By0JwtEnc,
    claimDebugFor0By0JwtEnc, confirmMultipleFor0By0JwtEnc,
    confirmBvcForConfirm0By1JwtEnc,
    // claims for 1
    claimBvcFor1By1JwtEnc,
    confirmIIW2019aFor1By0JwtEnc,
    claimIIW2019aFor1By1JwtEnc,
    // claims for 2
    confirmIIW2019aFor2By1JwtEnc,
    claimIIW2019aFor2By2JwtEnc,
    // claims for 3,
    // claims for 4
    claimFoodPantryFor4By4JwtEnc,
    confirmFoodPantryFor4By1JwtEnc,
    confirmFoodPantryFor4By2JwtEnc,
    // claims for 11
    claimCornerBakeryTenureFor11By11JwtEnc,
    confirmCornerBakeryTenureFor11By10JwtEnc,
    // claims for 12
    claimCornerBakeryTenureFor12By12JwtEnc

before(async () => {

  await Promise.all(pushTokenProms).then((jwts) => {
    pushTokens = jwts
    //console.log("Created controller push tokens", pushTokens)
  })

  await Promise.all(registerBy0Proms).then((jwts) => {
    registerBy0JwtEncs = jwts
    //console.log("Created register JWTs", registerBy0JwtEncs)
  })

  await Promise.all([
    claimBvcFor0By0JwtProm,
    confirmBvcFor0By0JwtProm,
    confirmBvcFor0By1JwtProm,
    confirmBvcFor0By3JwtProm,
    claimMyNightFor0By0JwtProm,
    claimBvcFor1By1JwtProm,
    claimDebugFor0By0JwtProm,
    confirmMultipleFor0By0JwtProm,
    confirmBvcForConfirm0By1JwtProm,
    claimCornerBakeryTenureFor11By11JwtProm,
    confirmCornerBakeryTenureFor11By10JwtProm,
    claimCornerBakeryTenureFor12By12JwtProm,
    claimFoodPantryFor4By4JwtProm,
    confirmFoodPantryFor4By1JwtProm,
    confirmFoodPantryFor4By2JwtProm,
    claimIIW2019aFor1By1JwtProm,
    confirmIIW2019aFor1By0JwtProm,
    claimIIW2019aFor2By2JwtProm,
    confirmIIW2019aFor2By1JwtProm,
  ]).then((jwts) => {
    [
      claimBvcFor0By0JwtEnc,
      confirmBvcFor0By0JwtEnc,
      confirmBvcFor0By1JwtEnc,
      confirmBvcFor0By3JwtEnc,
      claimMyNightFor0By0JwtEnc,
      claimBvcFor1By1JwtEnc,
      claimDebugFor0By0JwtEnc,
      confirmMultipleFor0By0JwtEnc,
      confirmBvcForConfirm0By1JwtEnc,
      claimCornerBakeryTenureFor11By11JwtEnc,
      confirmCornerBakeryTenureFor11By10JwtEnc,
      claimCornerBakeryTenureFor12By12JwtEnc,
      claimFoodPantryFor4By4JwtEnc,
      confirmFoodPantryFor4By1JwtEnc,
      confirmFoodPantryFor4By2JwtEnc,
      claimIIW2019aFor1By1JwtEnc,
      confirmIIW2019aFor1By0JwtEnc,
      claimIIW2019aFor2By2JwtEnc,
      confirmIIW2019aFor2By1JwtEnc,
    ] = jwts
    //console.log("Created controller user tokens", jwts)
  })

  return Promise.resolve()
})

describe('1 - Util', () => {

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
    const test = {b:[HIDDEN_TEXT]}
    test[HIDDEN_TEXT] = ["a"]
    expect(testUtil.allDidsAreHidden(test)).to.be.true

    expect(testUtil.anyDidIsHidden(null)).to.be.false
    expect(testUtil.anyDidIsHidden(9)).to.be.false
    expect(testUtil.anyDidIsHidden(true)).to.be.false
    expect(testUtil.anyDidIsHidden("stuff")).to.be.false
    expect(testUtil.anyDidIsHidden(HIDDEN_TEXT)).to.be.true
    expect(testUtil.anyDidIsHidden("did:x:0xabc123...")).to.be.false
    expect(testUtil.anyDidIsHidden({a:HIDDEN_TEXT, b:[HIDDEN_TEXT]})).to.be.true
    expect(testUtil.anyDidIsHidden({a:"did:x:0xabc123...", b:[HIDDEN_TEXT]})).to.be.true
    expect(testUtil.anyDidIsHidden(["a", "b", "c", {d: HIDDEN_TEXT}])).to.be.true
    expect(testUtil.anyDidIsHidden(["a", "b", "c", {d: "did:x:0xabc123..."}])).to.be.false
    expect(testUtil.anyDidIsHidden({"did:x:0xabc123...":["a"], b:[HIDDEN_TEXT]})).to.be.true
    expect(testUtil.anyDidIsHidden(test)).to.be.true
  })

  it('should return all DIDs inside', () => {
    expect(allDidsInside(null)).to.deep.equal([])
    expect(allDidsInside(9)).to.deep.equal([])
    expect(allDidsInside(true)).to.deep.equal([])
    expect(allDidsInside("stuff")).to.deep.equal([])
    expect(allDidsInside(HIDDEN_TEXT)).to.deep.equal([HIDDEN_TEXT])
    expect(allDidsInside("did:x:0xabc123...")).to.deep.equal(["did:x:0xabc123..."])
    expect(allDidsInside({a:HIDDEN_TEXT, b:[HIDDEN_TEXT]})).to.deep.equal([HIDDEN_TEXT])
    expect(allDidsInside({a:"did:x:0xabc123...", b:[HIDDEN_TEXT]})).to.deep.equal(["did:x:0xabc123...", HIDDEN_TEXT])
    expect(allDidsInside(["a", "b", "c", {d: HIDDEN_TEXT}])).to.deep.equal([HIDDEN_TEXT])
    expect(allDidsInside(["a", "b", "c", {d: "did:x:0xabc123..."}])).to.deep.equal(["did:x:0xabc123..."])
    expect(allDidsInside({"did:x:0xabc123...":["a"], b:[HIDDEN_TEXT]})).to.deep.equal([HIDDEN_TEXT])
    const test = {b:[]}
    test[HIDDEN_TEXT] = ["a"]
    expect(allDidsInside(test)).to.deep.equal([])

    const addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    const addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    const addra = 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761'
    const addrd = 'did:ethr:0xddd6c03f186c9e27bc150d3629d14d5dbea0effd'
    const addru = 'did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts'
    const someObj1 = {a: 1, b: addr0,       c: {d: addr6,       e: [], f: [9, {g: addru}]}}
    const repObj11 = {a: 1, b: HIDDEN_TEXT, c: {d: HIDDEN_TEXT, e: [], f: [9, {g: HIDDEN_TEXT}]}}
    const repObj12 = {a: 1, b: addr0,       c: {d: HIDDEN_TEXT, e: [], f: [9, {g: addru}]}}
    const someObj2 = {a: 1, b: 2}
    someObj2[addr0] = 9

    expect(allDidsInside(addr0)).to.deep.equal([addr0])
    expect(allDidsInside(someObj1)).to.deep.equal([addr0, addr6, addru])
    expect(allDidsInside(repObj11)).to.deep.equal([HIDDEN_TEXT])
    expect(allDidsInside(repObj12)).to.deep.equal([addr0, HIDDEN_TEXT, addru])
    expect(allDidsInside(someObj2)).to.deep.equal([])
  })

  it('should hide DIDs', () => {
    const addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    const addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    const addra = 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761'
    const addrd = 'did:ethr:0xddd6c03f186c9e27bc150d3629d14d5dbea0effd'
    const addru = 'did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts'
    const someObj1 = {a: 1, b: addr0,       c: {d: addr6,       e: [], f: [9, {g: addru}]}}
    const repObj11 = {a: 1, b: HIDDEN_TEXT, c: {d: HIDDEN_TEXT, e: [], f: [9, {g: HIDDEN_TEXT}]}}
    const repObj12 = {a: 1, b: addr0,       c: {d: HIDDEN_TEXT, e: [], f: [9, {g: addru}]}}

    const someObj2 = {a: 1, b: 2}
    someObj2[addr0] = 9
    const repObj21 = {a: 1, b: 2, 'did:none:HIDDEN_2': 9}

    const allowedDids0 = []
    const allowedDids1 = [addrd]
    const allowedDids3 = [addr0, addrd, addru]
    return Promise.all([
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, null)).to.eventually.deep.equal(null),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, 9)).to.eventually.equal(9),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, false)).to.eventually.equal(false),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, "Some random randomness")).to.eventually.equal("Some random randomness"),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, addru)).to.eventually.equal(HIDDEN_TEXT),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, {})).to.eventually.deep.equal({}),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, someObj1)).to.eventually.deep.equal(repObj11),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, [])).to.eventually.deep.equal([]),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, [someObj1])).to.eventually.deep.equal([repObj11]),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids0, addr0, someObj2)).to.eventually.deep.equal(repObj21),

      expect(hideDidsAndAddLinksToNetworkSub(allowedDids1, addr0, addrd)).to.eventually.deep.equal(addrd),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids1, addr0, addru)).to.eventually.deep.equal(HIDDEN_TEXT),

      expect(hideDidsAndAddLinksToNetworkSub(allowedDids3, addr0, addr0)).to.eventually.deep.equal(addr0),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids3, addr0, addra)).to.eventually.deep.equal(HIDDEN_TEXT),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids3, addr0, someObj1)).to.eventually.deep.equal(repObj12),
      expect(hideDidsAndAddLinksToNetworkSub(allowedDids3, addr0, someObj2)).to.eventually.deep.equal(repObj21),
    ])
  })


  it('should get a sorted object', () =>
     request(Server)
     .get('/api/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"c":\{"cb":2,"ca":1\},"a":4\}')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.headers['content-type'], /json/) // same as Content-Type check above
       expect(JSON.stringify(r.body.data))
         .to.deep.equal('{"a":4,"b":[5,1,2,3,{"ba":1,"bb":2,"bc":3}],"c":{"ca":1,"cb":2}}')
     }))

  it('should create correct claim hash chains', () => {
    const addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    const someObj1 = {a: 1, b: 2}
    const someObj2 = {a: 1, b: addr0}

    expect(claimHashChain("", [])).to.equal("")

    // crypto.createHash('sha256').update("" + crypto.createHash('sha256').update('{}').digest('base64')).digest('base64')
    //   = 'w34YiVcBFVEdwgL203VPgOa69RkU8rt9pniyje2RoFs='
    expect(claimHashChain("", ["{}"])).to.equal("w34YiVcBFVEdwgL203VPgOa69RkU8rt9pniyje2RoFs=")

    // crypto.createHash('sha256').update("" + crypto.createHash('sha256').update('{"a":1,"b":2}').digest('base64')).digest('base64')
    //   = '6myJt1PzGgzheZ90XXRLdsRV3glO8FLycKXe/o1OnA4='
    const chainedHashSomeObj1 = "6myJt1PzGgzheZ90XXRLdsRV3glO8FLycKXe/o1OnA4="
    expect(claimHashChain("", [JSON.stringify(someObj1)])).to.equal(chainedHashSomeObj1)

    // crypto.createHash('sha256').update(chainedHashSomeObj1 + crypto.createHash('sha256').update(JSON.stringify(someObj2)).digest('base64')).digest('base64')
    //   = 'U8hUSILfXzjmRlQrfzS34+/P2WcqKpBq731r7OnLIVU='
    const chainedHashSomeObj2 = "U8hUSILfXzjmRlQrfzS34+/P2WcqKpBq731r7OnLIVU="
    expect(claimHashChain(chainedHashSomeObj1, [JSON.stringify(someObj2)])).to.equal(chainedHashSomeObj2)
    expect(claimHashChain("", [JSON.stringify(someObj1), JSON.stringify(someObj2)])).to.equal(chainedHashSomeObj2)
  })

  it('should create correct nonce hash chains -- may be unused', () => {
    const addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    const addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    const someObj1 = {a: 1, b: 2}
    const someObj2 = {a: 1, b: addr0}
    const someObj3 = {a: "gabba", b: [addr6]}
    const nonce1 = "yD/looCdBKTIi8m6YP6MJC+U"
    const nonce2 = "rqGRCPn2yJXI5wM/LWqirOl2"
    const nonce3 = "/tV/c+DndHXQBsbEx2hx5spy"

    /**
     * emulating hashedClaimWithHashedDids
     *
    const addr0Hash =
      crypto.createHash('sha256')
        .update(addr0 + nonce2)
        .digest('hex')
    const someObj2WithHashAddr = {a: 1, b: "did:none:hashed:" + addr0Hash}
    const someObj2Hash =
      crypto.createHash('sha256')
        .update(JSON.stringify(someObj2WithHashAddr))
        .digest('base64')
    // "da751d154b3f18d30c4b0285b8e7d1659ef73d8af1b46443f37c631c8fa0aa29"
    console.log('someObj2Hash', someObj2Hash)

    const addr6Hash =
     crypto.createHash('sha256')
       .update(addr6 + nonce3)
       .digest('hex')
    const someObj3WithHashAddr = {a: "gabba", b: ["did:none:hashed:" + addr6Hash]}
    const someObj3Hash =
      crypto.createHash('sha256')
        .update(JSON.stringify(someObj3WithHashAddr))
        .digest('hex')
    // "82dbc917e03a716ac2cf5fcc05b402bea8613bd39fbdfdcb9047d13213f76d53"
    console.log('someObj3Hash', someObj3Hash)
     *
     */

    expect(nonceHashChain("", [])).to.equal("")
    // crypto.createHash('sha256').update(crypto.createHash('sha256').update('{}').digest('hex')).digest('hex')
    //   = 'b8a4120408a76e335316de9a0c139291da653eaffab9cb1406bccf615a0ff495'
    expect(nonceHashChain("", [{nonce:nonce1, claim:"{}"}])).to.equal("b8a4120408a76e335316de9a0c139291da653eaffab9cb1406bccf615a0ff495")

    // crypto.createHash('sha256').update('{"a":1,"b":2}').digest('hex')
    //   = '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777'
    // crypto.createHash('sha256').update(crypto.createHash('sha256').update('{"a":1,"b":2}').digest('hex')).digest('hex')
    //   = '5894f452548beeb4535e6a6746ea79b1c2a3547624f5e0c915372f5828939eac'
    const chainedHashSomeObj1 = "5894f452548beeb4535e6a6746ea79b1c2a3547624f5e0c915372f5828939eac"
    expect(nonceHashChain("", [{nonce:nonce1, claim:JSON.stringify(someObj1)}])).to.equal(chainedHashSomeObj1)
    // show that a change in the nonce doesn't matter if there are no DIDs
    expect(nonceHashChain("", [{nonce:nonce2, claim:JSON.stringify(someObj1)}])).to.equal(chainedHashSomeObj1)

    expect(nonceHashChain(chainedHashSomeObj1, [{nonce:nonce2, claim:JSON.stringify(someObj2)}])).to.equal("6282ed1671d528d99342003905d6ea99d07856e12ea3adc51af08fc69bf6488c")
    // show that a change in the ID matters if there are DIDs
    expect(nonceHashChain(chainedHashSomeObj1, [{nonce:nonce3, claim:JSON.stringify(someObj2)}])).to.not.equal("6282ed1671d528d99342003905d6ea99d07856e12ea3adc51af08fc69bf6488c")

    // show that it's the same as a 2-item chain
    expect(nonceHashChain("", [{nonce:nonce1, claim:JSON.stringify(someObj1)}, {nonce:nonce2, claim:JSON.stringify(someObj2)}])).to.equal("6282ed1671d528d99342003905d6ea99d07856e12ea3adc51af08fc69bf6488c")

    // now an entire chain of size 3
    expect(nonceHashChain("", [{nonce:nonce1, claim:JSON.stringify(someObj1)}, {nonce:nonce2, claim:JSON.stringify(someObj2)}, {nonce:nonce3, claim:JSON.stringify(someObj3)}])).to.equal("fda5be5b91b8f306cffdce22993cdaa176896167a63351d07e6970b041dfc2d4")
  })

})

let firstId, firstConfirmationClaimId, someEventId

describe('1 - Claim', () => {

  it('should get no claims', () =>
    request(Server)
      .get('/bad-bad-server-route')
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(404)
      })
  )

  it('should get no claims', () =>
     request(Server)
     .get('/api/claim')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     })
  )

  it('should get a 404 for an invalid claim number', () =>
     request(Server)
     .get('/api/claim/999')
     .then(r => {
       expect(400)
       expect(r.status).that.equals(404)
     })
  )

  it('should fail to claim with bad JWT: "Unexpected end of data"', () => {
    const headerPayload = pushTokens[3].substring(0, pushTokens[3].lastIndexOf('.') + 1)
    const badlySignedJwt = headerPayload + '_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_'
    if (process.env.NODE_ENV === 'test-local') {
      console.log('Skipping JWT verification test that requires online verification.')
    } else {
      return request(Server)
        .post('/api/claim')
        .set(UPORT_PUSH_TOKEN_HEADER, badlySignedJwt)
        .send({"jwtEncoded": claimBvcFor0By0JwtEnc})
        .expect('Content-Type', /json/)
        .then(r => {
          expect(r.status).that.equals(400)
          expect(r.body)
            .to.be.an('object')
            .that.has.property('error')
            .that.has.property('code')
            .to.equal('JWT_VERIFY_FAILED')
        })
    }
  }).timeout(5000)

  it('should fail to claim with bad JWT "Signature invalid for JWT"', () => {
    const lastChar = claimBvcFor0By0JwtEnc.charAt(claimBvcFor0By0JwtEnc.length - 1)
    // Just a guess, but I've seen 'A' and 'E' a lot and they seem to parse but fail signing checks.
    const newChar = lastChar === 'A' ? 'E' : 'A'
    const badlySignedJwt = claimBvcFor0By0JwtEnc.substring(0, claimBvcFor0By0JwtEnc.length - 1) + newChar
    if (process.env.NODE_ENV === 'test-local') {
      console.log('Skipping JWT verification test that requires online verification.')
    } else {
      return request(Server)
        .post('/api/claim')
        .send({"jwtEncoded": badlySignedJwt})
        .expect('Content-Type', /json/)
        .then(r => {
          expect(r.status).that.equals(400)
          expect(r.body)
            .to.be.an('object')
            .that.has.property('error')
            .that.has.property('code')
            .to.equal('JWT_VERIFY_FAILED')
          expect(r.body)
            .to.be.an('object')
            .that.has.property('error')
            .that.has.property('message')
            .to.endsWith('Signature invalid for JWT')
        })
    }
  }).timeout(3000)

  it('should fail to submit signed JWT for someone else', async () => {

    if (process.env.NODE_ENV === 'test-local') {
      console.log('Skipping JWT verification test that requires online verification.')
    } else {
      const claimBvcFor0ByEvil1JwtProm = createJWT(
        claimBvcFor0By0JwtObj,
        {
          payload: claimBvcFor0By0JwtObj,
          issuer: creds[0].did,
          signer: credentials[1].signer,
          alg: 'ES256K-R'
        }
      )
      const claimBvcFor0ByEvil1JwtEnc = await claimBvcFor0ByEvil1JwtProm
      return request(Server)
        .post('/api/claim')
        .send({"jwtEncoded": claimBvcFor0ByEvil1JwtEnc})
        .expect('Content-Type', /json/)
        .then(r => {
          expect(r.status).that.equals(400)
          expect(r.body)
            .to.be.an('object')
            .that.has.property('error')
            .that.has.property('code')
            .to.equal('JWT_VERIFY_FAILED')
          expect(r.body)
            .to.be.an('object')
            .that.has.property('error')
            .that.has.property('message')
            .to.endsWith('Signature invalid for JWT')
        })
    }
  }).timeout(3000)

  it('should add a new action claim with a raw createJWT call', async () => {
    const claimBvcFor0By0RawJwtProm = createJWT(
      claimBvcFor0By0JwtObj,
      {
        payload: claimBvcFor0By0JwtObj,
        issuer: creds[0].did,
        signer: credentials[0].signer,
        alg: 'ES256K-R'
      }
    )
    const claimBvcFor0By0RawJwtEnc = await claimBvcFor0By0RawJwtProm
    return request(Server)
      .post('/api/claim')
      .send({"jwtEncoded": claimBvcFor0By0RawJwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        firstId = r.body
        expect(r.status).that.equals(201)
      })
  }).timeout(5000)

  // All these 5000 waits are due to JWT verify, and the time doubled with ethr-did-resolver v6.
  // Each verification takes 1-1.8 seconds (sometimes over 2) and it verifies the push token and the claim.

  // This is a mirror of the previous test in a simpler way.
  // it('should add a new action claim from standard createVerification call', () =>
  //    request(Server)
  //    .post('/api/claim')
  //    .send({"jwtEncoded": claimBvcFor0By0JwtEnc})
  //    .expect('Content-Type', /json/)
  //    .then(r => {
  //      expect(r.body).to.be.a('string')
  //      firstId = r.body
  //      expect(r.status).that.equals(201)
  //    })
  // ).timeout(5000)

  it('should get our claim #1 with Authorization Bearer token', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set('Authorization', 'Bearer ' + pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('https://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals(creds[0].did)
       expect(r.status).that.equals(200)
     })
     .catch(e => {console.log(e); throw e}) // otherwise error results don't show
  ).timeout(3000)

  it('should get our claim #1 with uPort token', () =>
    request(Server)
      .get('/api/claim/' + firstId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.an('object')
          .that.has.a.property('claimContext')
          .that.equals('https://schema.org')
        expect(r.body)
          .that.has.a.property('claimType')
          .that.equals('JoinAction')
        expect(r.body)
          .that.has.a.property('issuer')
          .that.equals(creds[0].did)
        expect(r.status).that.equals(200)
      })
  ).timeout(3000)

  it('should get a claim with the DID hidden', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('https://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals(HIDDEN_TEXT)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should add a confirmation for that action (even though it is their own)', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmBvcFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       firstConfirmationClaimId = r.body
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should get 2 claims', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get 1 JoinAction claim', () =>
     request(Server)
     .get('/api/claim?claimType=JoinAction')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get 1 confirmation', () =>
     request(Server)
     .get('/api/claim?claimType=AgreeAction')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get one issuer (original claimant) who claimed or confirmed this', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should add another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimMyNightFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should add yet another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimBvcFor1By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should get a set of action claims & one confirmation', () =>
     request(Server)
     .get('/api/event/1/actionClaimsAndConfirmations')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('confirmations')
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get claims and confirmations for this event data', () => {
    const claimEncoded = encodeURIComponent(JSON.stringify(claimBvcFor1.event))
    return request(Server)
      .get('/api/event/actionClaimsAndConfirmations?event=' + claimEncoded)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.an('array')
          .of.length(1)
        expect(r.body[0])
          .to.be.an('object')
          .that.has.property('confirmations')
          .to.be.an('array')
          .of.length(0)
        expect(r.status).that.equals(200)
      })
  }).timeout(3000)

  it('#0 should see themselves', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .to.include.members([creds[0].did])
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should register user 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": registerBy0JwtEncs[1]})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('#0 should not see DID #1', () =>
    request(Server)
    .get('/api/report/whichDidsICanSee')
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body)
      .to.be.an('array')
      .to.not.include.members([creds[1].did])
      expect(r.status).that.equals(200)
    })
  ).timeout(3000)

  it('should add another new confirmation', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
      .send({"jwtEncoded": confirmBvcFor0By1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })
  ).timeout(5000)

  it('#0 should now see DID #1 as a side-effect of the claim by #1 that includes #0', () =>
    request(Server)
    .get('/api/report/whichDidsICanSee')
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body)
      .to.be.an('array')
      .to.include.members([creds[1].did])
      expect(r.status).that.equals(200)
    })
  ).timeout(3000)

  it('should register user 3', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[3]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })
  ).timeout(5000)

  it('should successfully add a second confirmation by someone else', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[3])
      .send({"jwtEncoded": confirmBvcFor0By3JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should add a new join claim for a debug event (Trent @ home, Thurs night debug, 2019-02-01T02:00:00Z)', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": claimDebugFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should retrieve the debug event (Trent @ home, Thurs night debug, 2019-02-01T02:00:00Z)', () =>
     request(Server)
     .get('/api/event?name=Thurs%20night%20debug')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body[0].orgName).that.equals('Trent @ home')
       someEventId = r.body[0].id
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should add yet another new confirmation of two claims', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmMultipleFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })
  ).timeout(5000)

  it('should get the right number of claims today', () =>
     request(Server)
     .get('/api/claim/?issuedAt_greaterThanOrEqualTo=' + encodeURIComponent(TODAY_START_TIME_STRING) + "&excludeConfirmations=true")
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(6)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

})

describe('1 - Action', () => {

  it('should get action with the right properties', () =>
     request(Server)
     .get('/api/action/1')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(r.body)
         .that.has.property('jwtId')
         .that.equals(firstId)
       expect(r.body)
         .that.has.property('eventId')
         .that.equals(1)
       expect(r.body)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(r.body)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29T15:00:00Z')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get complaint about a missing JWT', () =>
     request(Server)
     .get('/api/report/canSeeMe')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .that.equals("Missing Bearer JWT In Authorization header")
       expect(400)
       expect(r.status).that.equals(401)
     })
  ).timeout(3000)

  it('should get action with the DID hidden', () =>
     request(Server)
     .get('/api/action/1')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals(HIDDEN_TEXT)
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29T15:00:00Z')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get no actions that match query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T14:59:59Z')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get one action that matched query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T15:00:00Z')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       const action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(action1)
         .that.has.property('eventId')
         .that.equals(1)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29T15:00:00Z')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get enough past claims', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + encodeURIComponent(DAY_START_TIME_STRING))
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(4)
       const action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals(creds[0].did)
       expect(action1)
         .that.has.property('eventId')
         .that.equals(someEventId)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Trent @ home')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Thurs night debug')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2019-02-01T02:00:00Z')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get no actions today', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + encodeURIComponent(TODAY_START_TIME_STRING))
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

})

describe('1 - Event', () => {

  it('should get event with the right properties', () =>
     request(Server)
     .get('/api/event/1')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
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
         .that.equals('2018-12-29T15:00:00Z')
       expect(r.status).that.equals(200)
     }))

  it('should get 1 BVC event', () =>
     request(Server)
     .get('/api/event?orgName=Bountiful%20Voluntaryist%20Community')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     }))

  it('should get a set of action claims & three confirmations', () =>
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
         .to.be.an('array')
         .of.length(3)
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
     }))

  it('should not add a duplicate confirmation for this action', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmBvcFor0By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       // It creates a JWT record but not a new confirmation.
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should warn when adding a confirmation of a confirmation', () =>
     request(Server)
     .post('/api/v2/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": confirmBvcForConfirm0By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       // It creates a JWT record but warns about this usage.
       expect(r.body)
         .to.be.an('object')
         .that.has.property('success')
         .that.has.property('confirmations')
         .to.be.an('array')
       expect(r.body.success.confirmations[0])
         .that.has.property('embeddedRecordWarning')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get multiple action claims & still three confirmations', () =>
     request(Server)
     .get('/api/event/1/actionClaimsAndConfirmations')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('confirmations')
         .to.be.an('array')
         .of.length(3)
       expect(r.status).that.equals(200)
     }))

  it('should get multiple action claims and confirmations for this event data', () => {
    const claimEncoded = encodeURIComponent(JSON.stringify(claimBvcFor0.event))
    return request(Server)
      .get('/api/event/actionClaimsAndConfirmations?event=' + claimEncoded)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body[0])
          .to.be.an('object')
          .that.has.property('confirmations')
          .to.be.an('array')
          .of.length(3)
        expect(r.status).that.equals(200)
      })
    }).timeout(5000)

  it('should now get three issuers/confirmers for this claim ID', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(3)
       expect(r.status).that.equals(200)
     }))

  it('should get no issuers for an unknown claim', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=NOTHING')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('should get an issuer for confirming a valid claim', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=' + firstConfirmationClaimId)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     }))

})

describe('1 - Tenure', () => {

  it('should register user 12', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[12]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it ('should create a tenure', () =>
      request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
      .send({"jwtEncoded": claimCornerBakeryTenureFor12By12JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should get 1 claim', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     }))

})

describe('1 - Report', () => {

  it('should get right aggregated info', () =>
     request(Server)
     .get('/api/report/actionClaimsAndConfirmationsSince?dateTime=' + encodeURIComponent(START_TIME_STRING))
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
       const dddIndex =
           R.findIndex(R.whereEq({did: creds[0].did}))(r.body)
       const dddClaims = r.body[dddIndex].actions
       expect(dddClaims)
         .to.be.an('array')
         .of.length(3)
       expect(dddClaims[0].confirmations)
         .to.be.an('array')
         .of.length(3)
       expect(r.body[1].did)
         .to.be.an('string')
         .that.is.equal(creds[1].did)
       expect(r.body[1].actions)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     }))

  it('should get 1 tenure', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.status).that.equals(200)
     }))

  it('should get no tenures', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883943&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
       expect(r.status).that.equals(200)
     }))

})


describe('1 - Visibility utils', () => {

  it('should register user 2', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[2]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('#0 should set invisible to #2', () =>
    request(Server)
      .post('/api/report/cannotSeeMe')
      .send({ "did": creds[2].did })
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
      })
  ).timeout(3000)

  it('should get claims from other tests but cannot see inside any', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array')
       for (let i = 0; i < r.body.length; i++) {
         expect(testUtil.allDidsAreHidden(r.body[i], creds[2].did)).to.be.true
       }
       expect(r.status).that.equals(200)
     }))

  it('should register user 11', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[11]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should create a new tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[11])
     .send({ "jwtEncoded": claimCornerBakeryTenureFor11By11JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get claims and can see inside the most recent but cannot see inside the oldest', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array')
       expect(testUtil.allDidsAreHidden(r.body[0])).to.be.true
       expect(testUtil.allDidsAreHidden(r.body[r.body.length-1])).to.be.false
       expect(r.status).that.equals(200)
     }))

  it('should register user 10', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[10]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should confirm that competing tenure', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[10])
     .send({ "jwtEncoded": confirmCornerBakeryTenureFor11By10JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

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
     }))

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
     }))

  it('should register user 4', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[4]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  let foodPantryClaimBy4Id

  it('should create a tenure for the Food Pantry', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .send({ "jwtEncoded": claimFoodPantryFor4By4JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       foodPantryClaimBy4Id = r.body
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should confirm that tenure for the Food Pantry', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({ "jwtEncoded": confirmFoodPantryFor4By1JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get issuer and confirmer (even though confirmed claim format is different)', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=' + foodPantryClaimBy4Id)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(3000)


  //// Now #4 will toggle visibility from #5.

  it('#5 should not see #4', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[5])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .to.not.include.members([creds[4].did])
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#4 should set visible to #5', () =>
     request(Server)
     .post('/api/report/canSeeMe')
     .send({ "did": creds[5].did })
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
     }))

  it('#5 should see #4', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[5])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .to.include.members([creds[4].did])
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#4 can tell that #5 can see them', () =>
     request(Server)
     .get('/api/report/canDidExplicitlySeeMe?did=' + creds[5].did)
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.true
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#4 should set invisible to #5', () =>
     request(Server)
     .post('/api/report/cannotSeeMe')
     .send({ "did": creds[5].did })
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#5 should not see #4 again', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[5])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .to.not.include.members([creds[4].did])
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#5 should get claim but not see #4', () =>
    request(Server)
    .get('/api/claim/' + foodPantryClaimBy4Id)
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body.issuer).to.equal(HIDDEN_TEXT)
      expect(r.body.claim.party.identifier).to.equal(HIDDEN_TEXT)
      console.log(r.body)
      expect(r.status).that.equals(200)
    })).timeout(3000)

  let foodPantryBy4ConfirmedBy2Id

  it('#2 can confirm #4 tenure for the Food Pantry (even though #4 does not allow visibility)', () =>
    request(Server)
    .post('/api/claim')
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
    .send({ "jwtEncoded": confirmFoodPantryFor4By2JwtEnc })
    .expect('Content-Type', /json/)
    .then(r => {
      console.log(r.body)
      expect(r.body).to.be.a('string')
      foodPantryBy4ConfirmedBy2Id = r.body
      expect(r.status).that.equals(201)
    })).timeout(5000)

  it('#2 can get claim and see inside all details since they made that claim, even though #4 restricted visibility', () =>
    request(Server)
    .get('/api/claim/' + foodPantryBy4ConfirmedBy2Id)
    .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
    //.expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.an('object')
      expect(testUtil.anyDidIsHidden(r.body)).to.be.false
      expect(r.status).that.equals(200)
    }))

})

describe('1 - Transitive Connections', () => {

  it('should claim attendance for 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": claimIIW2019aFor1By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should claim attendance for 2', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({"jwtEncoded": claimIIW2019aFor2By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should confirm attendance for 1 by 0', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
     .send({"jwtEncoded": confirmIIW2019aFor1By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should confirm attendance for 2 by 1', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
     .send({"jwtEncoded": confirmIIW2019aFor2By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

})
