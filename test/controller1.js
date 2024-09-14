
// Tests for utils, initial claims, actions, events, tenures, other reports, and visibility in connections

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import chaiString from 'chai-string'
import crypto from 'crypto'
import { createJWT } from 'did-jwt'
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'

import Server from '../server'
import util, { allDidsInside, calcBbox, claimHashChain, HIDDEN_TEXT, inputContainsDid, nonceHashChain } from '../server/api/services/util';
import { hideDidsAndAddLinksToNetworkSub } from '../server/api/services/util-higher';
import testUtil from './util'
import canonicalize from "canonicalize";
import base64url from "base64url";

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


const creds = testUtil.ethrCredData

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

const credentials = testUtil.ethrCredentials

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)

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

const registerPeerBy0JwtObj = R.clone(testUtil.jwtTemplate)
registerPeerBy0JwtObj.claim = R.clone(testUtil.registrationTemplate)
registerPeerBy0JwtObj.claim.agent.identifier = creds[0].did
registerPeerBy0JwtObj.claim.participant.identifier = "did:peer:0zKMFjvUgYrM1hXwDcmm4BbxKbRNQaXRJrCPaBZtCoihsLTPJBpgUtC9Kd9prz1oTqxWemFfNWCNgLEJyP4FoLKtmnWhQqaCnBefWomGrSA3v4"
registerPeerBy0JwtObj.sub = "did:peer:0zKMFjvUgYrM1hXwDcmm4BbxKbRNQaXRJrCPaBZtCoihsLTPJBpgUtC9Kd9prz1oTqxWemFfNWCNgLEJyP4FoLKtmnWhQqaCnBefWomGrSA3v4"
const registerPeerBy0JwtProm = credentials[0].createVerification(registerPeerBy0JwtObj)

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

let pushTokens, registerBy0JwtEncs, registerPeerBy0JwtEnc,
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

  registerPeerBy0JwtProm.then((jwt) => {
    registerPeerBy0JwtEnc = jwt
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

const pizzaGivePeerJwtEnc = "eyJ0eXAiOiJKV0FOVCIsImFsZyI6IkVTMjU2In0.eyJBdXRoZW50aWNhdGlvbkRhdGFCNjRVUkwiOiJTWllONVlnT2pHaDBOQmNQWkhaZ1c0X2tycm1paGpMSG1Wenp1b01kbDJNRkFBQUFBQSIsIkNsaWVudERhdGFKU09OQjY0VVJMIjoiZXlKMGVYQmxJam9pZDJWaVlYVjBhRzR1WjJWMElpd2lZMmhoYkd4bGJtZGxJam9pWlhsS01sbDVTVFpsZVVwcVkyMVdhMXBYTlRCaFYwWnpWVE5XYVdGdFZtcGtRMGsyWlhsS1FWa3lPWFZrUjFZMFpFTkpOa2x0YURCa1NFSjZUMms0ZG1NeVRtOWFWekZvVEcwNWVWcDVTWE5KYTBJd1pWaENiRWxxYjJsU01td3lXbFZHYW1SSGJIWmlhVWx6U1cxU2JHTXlUbmxoV0VJd1lWYzVkVWxxYjJsalIydzJaVzFGYVdaWU1ITkpiVlkwWTBOSk5rMVVZM2xOUkUwMFQwUlZNazE1ZDJsaFYwWXdTV3B2ZUU1NlNYZE5lbWMwVGxSQmVreERTbkJqTTAxcFQybEthMkZYVVRaalIxWnNZMnB2ZDJWcmRFNVNiWEF5Vmxka1dtTnJNSGhoUm1nelVrZE9kR0pVVWtOWmJtaE1XV3hLVDFWWFJsbFZhM0I1VVRGQ2FGRnNjREJSTWpsd1lVaE9UVlpHUWt0UmJrSnVWbGhTUkU5VmRHdFBXRUo1WldwR2RsWklSalJXTWxaMFVtMWFUMVl3VGs5YU1IaEdVMjVzVVU1RlduWlVSWFF3WWxjMVdHRkdSbmhaVlU1MVVXMVdiVll5T1hSU00wcFVVVlJPTWs1RFNqa2lMQ0p2Y21sbmFXNGlPaUpvZEhSd09pOHZiRzlqWVd4b2IzTjBPamd3T0RBaUxDSmpjbTl6YzA5eWFXZHBiaUk2Wm1Gc2MyVjkiLCJleHAiOjE3MjAzODg1NjMsImlhdCI6MTcyMDM4ODUwMywiaXNzIjoiZGlkOnBlZXI6MHpLTUZqdlVnWXJNMWhYd0RjbW00QmJ4S2JSTlFhWFJKckNQYUJadENvaWhzTFRQSkJwZ1V0QzlLZDlwcnoxb1RxeFdlbUZmTldDTmdMRUp5UDRGb0xLdG1uV2hRcWFDbkJlZldvbUdyU0EzdjQifQ.MEQCIAsMMNUcSjoxn0LZuE6FvZ6dsm-uQROeX3RPWt6QlRyPAiA670XdJXnLw8QFR9a6KCMt-qUyGZg88mMfT-1DtipcwA";
const pizzaGivePeerBadSigJwtEnc = "eyJ0eXAiOiJKV0FOVCIsImFsZyI6IkVTMjU2In0.eyJBdXRoZW50aWNhdGlvbkRhdGFCNjRVUkwiOiJTWllONVlnT2pHaDBOQmNQWkhaZ1c0X2tycm1paGpMSG1Wenp1b01kbDJNRkFBQUFBQSIsIkNsaWVudERhdGFKU09OQjY0VVJMIjoiZXlKMGVYQmxJam9pZDJWaVlYVjBhRzR1WjJWMElpd2lZMmhoYkd4bGJtZGxJam9pWlhsS01sbDVTVFpsZVVwcVkyMVdhMXBYTlRCaFYwWnpWVE5XYVdGdFZtcGtRMGsyWlhsS1FWa3lPWFZrUjFZMFpFTkpOa2x0YURCa1NFSjZUMms0ZG1NeVRtOWFWekZvVEcwNWVWcDVTWE5KYTBJd1pWaENiRWxxYjJsU01td3lXbFZHYW1SSGJIWmlhVWx6U1cxU2JHTXlUbmxoV0VJd1lWYzVkVWxxYjJsalIydzJaVzFGYVdaWU1ITkpiVlkwWTBOSk5rMVVZM2xOUkUwMFQwUlZNazE1ZDJsaFYwWXdTV3B2ZUU1NlNYZE5lbWMwVGxSQmVreERTbkJqTTAxcFQybEthMkZYVVRaalIxWnNZMnB2ZDJWcmRFNVNiWEF5Vmxka1dtTnJNSGhoUm1nelVrZE9kR0pVVWtOWmJtaE1XV3hLVDFWWFJsbFZhM0I1VVRGQ2FGRnNjREJSTWpsd1lVaE9UVlpHUWt0UmJrSnVWbGhTUkU5VmRHdFBXRUo1WldwR2RsWklSalJXTWxaMFVtMWFUMVl3VGs5YU1IaEdVMjVzVVU1RlduWlVSWFF3WWxjMVdHRkdSbmhaVlU1MVVXMVdiVll5T1hSU00wcFVVVlJPTWs1RFNqa2lMQ0p2Y21sbmFXNGlPaUpvZEhSd09pOHZiRzlqWVd4b2IzTjBPamd3T0RBaUxDSmpjbTl6YzA5eWFXZHBiaUk2Wm1Gc2MyVjkiLCJleHAiOjE3MjAzODg1NjMsImlhdCI6MTcyMDM4ODUwMywiaXNzIjoiZGlkOnBlZXI6MHpLTUZqdlVnWXJNMWhYd0RjbW00QmJ4S2JSTlFhWFJKckNQYUJadENvaWhzTFRQSkJwZ1V0QzlLZDlwcnoxb1RxeFdlbUZmTldDTmdMRUp5UDRGb0xLdG1uV2hRcWFDbkJlZldvbUdyU0EzdjQifQ.MEQCIAsMMNUcSjoxn0LZuE6FvZ6dsm-uQROeX3RPWt6QlRyPAiA670XdJXnLw8QFR9a6KCMt-qUyGZg88mMfT-1DtipcwZ";
const pizzaGivePeerMissingExpJwtEnc = "eyJ0eXAiOiJKV0FOVCIsImFsZyI6IkVTMjU2In0.eyJBdXRoZW50aWNhdGlvbkRhdGFCNjRVUkwiOiJTWllONVlnT2pHaDBOQmNQWkhaZ1c0X2tycm1paGpMSG1Wenp1b01kbDJNRkFBQUFBQSIsIkNsaWVudERhdGFKU09OQjY0VVJMIjoiZXlKMGVYQmxJam9pZDJWaVlYVjBhRzR1WjJWMElpd2lZMmhoYkd4bGJtZGxJam9pWlhsS01sbDVTVFpsZVVwcVkyMVdhMXBYTlRCaFYwWnpWVE5XYVdGdFZtcGtRMGsyWlhsS1FWa3lPWFZrUjFZMFpFTkpOa2x0YURCa1NFSjZUMms0ZG1NeVRtOWFWekZvVEcwNWVWcDVTWE5KYTBJd1pWaENiRWxxYjJsU01td3lXbFZHYW1SSGJIWmlhVWx6U1cxU2JHTXlUbmxoV0VJd1lWYzVkVWxxYjJsalIydzJaVzFGYVdaWU1ITkpiVlkwWTBOSk5rMVVZM2xOUkZGM1RXcFJOVTFwZDJsaFYwWXdTV3B2ZUU1NlNYZE9SRUY1VGtSTmVVeERTbkJqTTAxcFQybEthMkZYVVRaalIxWnNZMnB2ZDJWcmRFNVNiWEF5Vmxka1dtTnJNSGhoUm1nelVrZE9kR0pVVWtOWmJtaE1XV3hLVDFWWFJsbFZhM0I1VVRGQ2FGRnNjREJSTWpsd1lVaE9UVlpHUWt0UmJrSnVWbGhTUkU5VmRHdFBXRUo1WldwR2RsWklSalJXTWxaMFVtMWFUMVl3VGs5YU1IaEdVMjVzVVU1RlduWlVSWFF3WWxjMVdHRkdSbmhaVlU1MVVXMVdiVll5T1hSU00wcFVVVlJPTWs1RFNqa2lMQ0p2Y21sbmFXNGlPaUpvZEhSd09pOHZiRzlqWVd4b2IzTjBPamd3T0RBaUxDSmpjbTl6YzA5eWFXZHBiaUk2Wm1Gc2MyVjkiLCJpYXQiOjE3MjA0MDI0MzIsImlzcyI6ImRpZDpwZWVyOjB6S01GanZVZ1lyTTFoWHdEY21tNEJieEtiUk5RYVhSSnJDUGFCWnRDb2loc0xUUEpCcGdVdEM5S2Q5cHJ6MW9UcXhXZW1GZk5XQ05nTEVKeVA0Rm9MS3RtbldoUXFhQ25CZWZXb21HclNBM3Y0In0.MEUCIQCH1rR7h_gldBle7mXYVuXYO25Y6HzxC9g5T-i-mXWUvgIgdgtZ8OZDqDT5et8ECpcIMlfAyHGO1TPk9LJlmO2Omuk";
//const pizzaGivePeerExpiredExpJwtEnc = ""; // need a way to generate these JWTs so that we can make current & expired ones
const pizzaGivePeerMismatchedExpJwtEnc = "eyJ0eXAiOiJKV0FOVCIsImFsZyI6IkVTMjU2In0.eyJBdXRoZW50aWNhdGlvbkRhdGFCNjRVUkwiOiJTWllONVlnT2pHaDBOQmNQWkhaZ1c0X2tycm1paGpMSG1Wenp1b01kbDJNRkFBQUFBQSIsIkNsaWVudERhdGFKU09OQjY0VVJMIjoiZXlKMGVYQmxJam9pZDJWaVlYVjBhRzR1WjJWMElpd2lZMmhoYkd4bGJtZGxJam9pWlhsS01sbDVTVFpsZVVwcVkyMVdhMXBYTlRCaFYwWnpWVE5XYVdGdFZtcGtRMGsyWlhsS1FWa3lPWFZrUjFZMFpFTkpOa2x0YURCa1NFSjZUMms0ZG1NeVRtOWFWekZvVEcwNWVWcDVTWE5KYTBJd1pWaENiRWxxYjJsU01td3lXbFZHYW1SSGJIWmlhVWx6U1cxU2JHTXlUbmxoV0VJd1lWYzVkVWxxYjJsalIydzJaVzFGYVdaWU1ITkpiVlkwWTBOSk5rMVVZM2xOUkZGM1RXcE5NRTFEZDJsaFYwWXdTV3B2ZUU1NlNYZE9SRUY1VFdwbmQweERTbkJqTTAxcFQybEthMkZYVVRaalIxWnNZMnB2ZDJWcmRFNVNiWEF5Vmxka1dtTnJNSGhoUm1nelVrZE9kR0pVVWtOWmJtaE1XV3hLVDFWWFJsbFZhM0I1VVRGQ2FGRnNjREJSTWpsd1lVaE9UVlpHUWt0UmJrSnVWbGhTUkU5VmRHdFBXRUo1WldwR2RsWklSalJXTWxaMFVtMWFUMVl3VGs5YU1IaEdVMjVzVVU1RlduWlVSWFF3WWxjMVdHRkdSbmhaVlU1MVVXMVdiVll5T1hSU00wcFVVVlJPTWs1RFNqa2lMQ0p2Y21sbmFXNGlPaUpvZEhSd09pOHZiRzlqWVd4b2IzTjBPamd3T0RBaUxDSmpjbTl6YzA5eWFXZHBiaUk2Wm1Gc2MyVjkiLCJleHAiOjE3MjA0MDIzNDEsImlhdCI6MTcyMDQwMjI4MCwiaXNzIjoiZGlkOnBlZXI6MHpLTUZqdlVnWXJNMWhYd0RjbW00QmJ4S2JSTlFhWFJKckNQYUJadENvaWhzTFRQSkJwZ1V0QzlLZDlwcnoxb1RxeFdlbUZmTldDTmdMRUp5UDRGb0xLdG1uV2hRcWFDbkJlZldvbUdyU0EzdjQifQ.MEUCIQDRXvrVZLEECG7F1Tkfo-f7cIB198mxFxC1D0GYgw1abwIgUvXt3W79Lc0wNCQngMgbZLcqjIbVqAjZNaLosgi9LwM";
const pizzaGivePeerMismatchedIssJwtEnc = "eyJ0eXAiOiJKV0FOVCIsImFsZyI6IkVTMjU2In0.eyJBdXRoZW50aWNhdGlvbkRhdGFCNjRVUkwiOiJTWllONVlnT2pHaDBOQmNQWkhaZ1c0X2tycm1paGpMSG1Wenp1b01kbDJNRkFBQUFBQSIsIkNsaWVudERhdGFKU09OQjY0VVJMIjoiZXlKMGVYQmxJam9pZDJWaVlYVjBhRzR1WjJWMElpd2lZMmhoYkd4bGJtZGxJam9pWlhsS01sbDVTVFpsZVVwcVkyMVdhMXBYTlRCaFYwWnpWVE5XYVdGdFZtcGtRMGsyWlhsS1FWa3lPWFZrUjFZMFpFTkpOa2x0YURCa1NFSjZUMms0ZG1NeVRtOWFWekZvVEcwNWVWcDVTWE5KYTBJd1pWaENiRWxxYjJsU01td3lXbFZHYW1SSGJIWmlhVWx6U1cxU2JHTXlUbmxoV0VJd1lWYzVkVWxxYjJsalIydzJaVzFGYVdaWU1ITkpiVlkwWTBOSk5rMVVZM2xOUkZGM1RXcFZNRTlUZDJsaFYwWXdTV3B2ZUU1NlNYZE9SRUY1VGtSbk5VeERTbkJqTTAxcFQybEthMkZYVVRaalIxWnNZMnB2ZDJWcmRFNVNiWEF5Vmxka1dtTnJNSGhoUm1nelVrZE9kR0pVVWtOWmJtaE1XV3hLVDFWWFJsbFZhM0I1VVRGQ2FGRnNjREJSTWpsd1lVaE9UVlpHUWt0UmJrSnVWbGhTUkU5VmRHdFBXRUo1WldwR2RsWklSalJXTWxaMFVtMWFUMVl3VGs5YU1IaEdVMjVzVVU1RlduWlVSWFF3WWxjMVdHRkdSbmhaVlU1MVVXMVdiVll5T1hSU00wcFVVVlJPTWs1RFNqa2lMQ0p2Y21sbmFXNGlPaUpvZEhSd09pOHZiRzlqWVd4b2IzTjBPamd3T0RBaUxDSmpjbTl6YzA5eWFXZHBiaUk2Wm1Gc2MyVjkiLCJleHAiOjE3MjA0MDI1NDksImlhdCI6MTcyMDQwMjQ4OX0.MEUCIQCzAL-LCq9wkpKQ2Rt9WC7oDOzZz8XMOJY3YpT5qr7HogIgcF4MlO4l_adORHE-AFgn5oxRPTiQhlluA_oIrn2-XZc";

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

    expect(inputContainsDid(null, addr0)).to.be.false
    expect(inputContainsDid(9, addr0)).to.be.false
    expect(inputContainsDid({}, addr0)).to.be.false
    expect(inputContainsDid([], addr0)).to.be.false
    expect(inputContainsDid([addr0], addr0)).to.be.true
    expect(inputContainsDid([addr0], addru)).to.be.false
    expect(inputContainsDid(addr0, addr0)).to.be.true
    expect(inputContainsDid(addru, addr0)).to.be.false
    expect(inputContainsDid(someObj1, addr0)).to.be.true
    expect(inputContainsDid(someObj1, addra)).to.be.false
    expect(inputContainsDid(someObj1, addru)).to.be.true
    expect(inputContainsDid(someObj2, addr0)).to.be.false
    expect(inputContainsDid(someObj2, addra)).to.be.false
    expect(inputContainsDid(someObj2, addru)).to.be.false
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

    // crypto.createHash('sha256').update("" + crypto.createHash('sha256').update('{}').digest('base64url')).digest('base64url')
    //   = '0uSveuyRQrrja_6mMXGEpa_PM-W4ZqKS0ahj83ZMpG8'
    expect(claimHashChain("", ["{}"])).to.equal("0uSveuyRQrrja_6mMXGEpa_PM-W4ZqKS0ahj83ZMpG8")

    // crypto.createHash('sha256').update("" + crypto.createHash('sha256').update('{"a":1,"b":2}').digest('base64url')).digest('base64url')
    //   = 'meyMuuuSTOftzgfMexKiyKXXUU5u5R-xH3iUlnEjqEE'
    const chainedHashSomeObj1 = "meyMuuuSTOftzgfMexKiyKXXUU5u5R-xH3iUlnEjqEE"
    expect(claimHashChain("", [JSON.stringify(someObj1)])).to.equal(chainedHashSomeObj1)

    // crypto.createHash('sha256').update(chainedHashSomeObj1 + crypto.createHash('sha256').update(JSON.stringify(someObj2)).digest('base64url')).digest('base64url')
    //   = 'QxGQLGaT-AVth4yflIzsW3QEFwtPJaJnKs-vo2LO8-8'
    const chainedHashSomeObj2 = "QxGQLGaT-AVth4yflIzsW3QEFwtPJaJnKs-vo2LO8-8"
    expect(claimHashChain(chainedHashSomeObj1, [JSON.stringify(someObj2)])).to.equal(chainedHashSomeObj2)
    expect(claimHashChain("", [JSON.stringify(someObj1), JSON.stringify(someObj2)])).to.equal(chainedHashSomeObj2)
  })

  it('should create correct nonce hash chains -- may be unused', () => {
    const addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    const addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    const someObj1 = {a: 1, b: 2}
    const someObj2 = {a: 1, b: addr0}
    const someObj3 = {a: "gabba", b: [addr6]}
    const nonce1 = "yD_looCdBKTIi8m6YP6MJC-U"
    const nonce2 = "rqGRCPn2yJXI5wM_LWqirOl2"
    const nonce3 = "_tV_c-DndHXQBsbEx2hx5spy"
    const time1 = 1725291728
    const time2 = 1725300425
    const time3 = 1725300443

    expect(nonceHashChain("", [])).to.equal("")
    /**
     *

     const didNonceHashed = "did:none:noncedhashed:" + crypto.createHash('sha256').update(addr0 + nonce1).digest('hex')
     console.log('didNonceHashed', didNonceHashed)
     // 'did:none:noncedhashed:0cf61e83d00c36f3bddebfdbdf75d04b419b19fc6fdcf605db9118eb67854007'
     // latest tx
     crypto.createHash('sha256').update(canonicalize({"claim":{},"issuedAt":time1,"issuerDid":didNonceHashed})).digest('base64url')
     // 'PJFM9ePuxdczITFOgqG6RGYmm0pUKT-wRBuHNpQtflw'
     // chained
     crypto.createHash('sha256').update(
       "" + crypto.createHash('sha256').update(canonicalize({"claim":{},"issuedAt":time1,"issuerDid":didNonceHashed})).digest('base64url')
     ).digest('base64url')
     // 'o0zk4DSLYLT4a8-ihiub078BRnB4p9sGOoe85pfIBxE'

     *
     **/
    expect(nonceHashChain("", [{nonce:nonce1, claimStr:"{}", issuedAt: time1, issuerDid: addr0}]))
    .to.equal("o0zk4DSLYLT4a8-ihiub078BRnB4p9sGOoe85pfIBxE")

    /**
     * emulating hashedClaimWithHashedDids
     *

     const claimEtcNoncedCanon = canonicalize({"claim":someObj1,"issuedAt":time1,"issuerDid":didNonceHashed})
     console.log('claimEtcNoncedCanon', claimEtcNoncedCanon)
     const firstNoncedHash = crypto.createHash('sha256').update("" + crypto.createHash('sha256').update(claimEtcNoncedCanon).digest('base64url')).digest('base64url')
     console.log('firstNoncedHash', firstNoncedHash)
     // '-k7Mk8qfc84mmXVEv4TNWITrGYFqfV-9FIFPmXLQrXM'

     *
     */
    const chainedHashSomeObj1 = "-k7Mk8qfc84mmXVEv4TNWITrGYFqfV-9FIFPmXLQrXM"
    expect(nonceHashChain("", [{nonce:nonce1, claimStr:JSON.stringify(someObj1), issuedAt:time1, issuerDid:addr0}]))
    .to.equal(chainedHashSomeObj1)

    /**
     *

     const didNonceHashed2 = "did:none:noncedhashed:" + crypto.createHash('sha256').update(addr0 + nonce2).digest('hex')
     console.log('didNonceHashed2', didNonceHashed2)
     // 'f62c5a03f4bd2faa9f436abce4c09e3a9d48cf41d8fd9083be603aec0b49ce7c'
     const someObj2WithHashAddr2 = {...someObj2, b: didNonceHashed2 }
     const claimEtcNoncedCanon2 = canonicalize({"claim":someObj2WithHashAddr2,"issuedAt":time2,"issuerDid":didNonceHashed2})
     console.log('claimEtcNoncedCanon2', claimEtcNoncedCanon2)
     const noncedCanon2Hash = crypto.createHash('sha256').update(claimEtcNoncedCanon2).digest('base64url')
     const secondNoncedHashChain = crypto.createHash('sha256').update(firstNoncedHash + noncedCanon2Hash).digest('base64url')
     console.log('secondNoncedHashChain', secondNoncedHashChain)
     // 'i22T-hFDTQy9wAYzZKDJChD9mdvu0BXtlCne3uBx__Q'

     *
     */
    expect(nonceHashChain(chainedHashSomeObj1, [{nonce:nonce2, claimStr:JSON.stringify(someObj2), issuedAt:time2, issuerDid:addr0}]))
    .to.equal("i22T-hFDTQy9wAYzZKDJChD9mdvu0BXtlCne3uBx__Q")

    // show that it's the same as a 2-item chain
    expect(nonceHashChain("", [{nonce:nonce1, claimStr:JSON.stringify(someObj1), issuedAt:time1, issuerDid:addr0}, {nonce:nonce2, claimStr:JSON.stringify(someObj2), issuedAt:time2, issuerDid:addr0}]))
    .to.equal("i22T-hFDTQy9wAYzZKDJChD9mdvu0BXtlCne3uBx__Q")

    // now an entire chain of size 3
    /**
     *

     const didNonceHashed3 = "did:none:noncedhashed:" + crypto.createHash('sha256').update(addr6 + nonce3).digest('hex')
     console.log('didNonceHashed3', didNonceHashed3)
     // 'e6378fb8b89de7784180a9edab1e56330f14ec6fe257df30b0899b47bf6c36ba'
     const someObj3WithHashAddr3 = {...someObj3, b: [didNonceHashed3] }
     const claimEtcNoncedCanon3 = canonicalize({"claim":someObj3WithHashAddr3,"issuedAt":time3,"issuerDid":didNonceHashed3})
     console.log('claimEtcNoncedCanon3', claimEtcNoncedCanon3)
     const noncedCanon3Hash = crypto.createHash('sha256').update(claimEtcNoncedCanon3).digest('base64url')
     const thirdNoncedHashChain = crypto.createHash('sha256').update(secondNoncedHashChain + noncedCanon3Hash).digest('base64url')
     console.log('thirdNoncedHashChain', thirdNoncedHashChain)
     // 'Wunf2muBF6Vd6ycyXshGE00ubWdchgJbL8s_JpPbUCo'

     *
     */
    expect(nonceHashChain("", [{nonce:nonce1, claimStr:JSON.stringify(someObj1), issuedAt:time1, issuerDid:addr0}, {nonce:nonce2, claimStr:JSON.stringify(someObj2), issuedAt:time2, issuerDid:addr0}, {nonce:nonce3, claimStr:JSON.stringify(someObj3), issuedAt:time3, issuerDid:addr6}]))
    .to.equal("Wunf2muBF6Vd6ycyXshGE00ubWdchgJbL8s_JpPbUCo")
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
    const headerPayload = pushTokens[0].substring(0, pushTokens[0].lastIndexOf('.'))
    const badlySignedJwt = headerPayload + '._-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_'
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + badlySignedJwt)
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
  })

  it('should fail to claim with bad JWT "Signature invalid for JWT"', () => {
    const lastChar = claimBvcFor0By0JwtEnc.charAt(claimBvcFor0By0JwtEnc.length - 1)
    // Just a guess, but I've seen 'A' and 'E' a lot and they seem to parse but fail signing checks.
    const newChar = lastChar === 'A' ? 'E' : 'A'
    const badlySignedJwt = claimBvcFor0By0JwtEnc.substring(0, claimBvcFor0By0JwtEnc.length - 1) + newChar
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
          .to.endsWith('no matching public key found')
      })
  })

  it('should fail to submit signed JWT for someone else', async () => {

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
          .to.endsWith('no matching public key found')
      })
  })

  let firstClaimTime, firstNonce
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
    const claimStrSent = claimBvcFor0By0RawJwtEnc.split('.')[1]
    firstClaimTime = JSON.parse(base64url.decode(claimStrSent)).iat
    return request(Server)
      .post('/api/v2/claim')
      .send({"jwtEncoded": claimBvcFor0By0RawJwtEnc})
      .then(r => {
        expect(r.body).to.be.an('object')
        firstId = r.body.success.claimId
        firstNonce = r.body.success.hashNonce
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
      })
  })

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
  // )

  it('should set the hashes in the chain', () =>
    request(Server)
    .post('/api/util/updateHashChain')
    .then(r => {
      expect(r.body)
      .that.has.a.property('data')
      const data = r.body.data
      expect(data).that.has.a.property('count').that.equals(1)
      expect(data).that.has.a.property('lastNoncedHashAllChain').that.is.not.empty
    })
  )

  it('should get our claim #1 with Authorization Bearer token', () => {
    const canon = canonicalize(claimBvcFor0By0JwtObj.claim)
    return (
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
        const nonceAndClaimStrEtc = {
          nonce: firstNonce,
          claimStr: canon,
          iat: firstClaimTime,
          iss: creds[0].did,
        }
        const firstNonceHash = util.hashedClaimWithHashedDids(nonceAndClaimStrEtc)
        expect(r.body)
        .that.has.a.property('noncedHash')
        .that.equals(firstNonceHash)
        expect(r.status).that.equals(200)
      })
      .catch(e => {
        console.error(e);
        throw e
      }) // otherwise error results don't show
    )
  })

  it('should get our claim #1 with even more info from /full', () => {
    return (
      request(Server)
      .get('/api/claim/full/' + firstId)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
        .that.has.a.property('hashNonce')
        expect(r.status).that.equals(200)
      })
      .catch(e => {
        console.error(e);
        throw e
      }) // otherwise error results don't show
    )
  })

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
       expect(r.body)
       .that.does.not.have.property('hashNonce')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should add a confirmation for that action (even though it is their own)', () =>
    request(Server)
    .post('/api/claim')
    .set('Authorization', 'Bearer ' + pushTokens[0])
    .send({"jwtEncoded": confirmBvcFor0By0JwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.a('string')
      firstConfirmationClaimId = r.body
      expect(r.status).that.equals(201)
    })
  ).timeout(5000)

  it('should fail when sending an Auth that does not match claim', () =>
    request(Server)
    .post('/api/claim')
    .set('Authorization', 'Bearer ' + pushTokens[1])
    .send({"jwtEncoded": confirmBvcFor0By0JwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(500) // should be 400 -- must change result of Promise.reject
    })
  ).timeout(3000)

  it('should get 2 claims', () =>
     request(Server)
     .get('/api/claim')
     .set('Authorization', 'Bearer ' + pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
       .to.be.an('array')
       .of.length(2)
       expect(r.body[0])
       .that.does.not.have.property('hashNonce')
       expect(r.body[1])
       .that.does.not.have.property('hashNonce')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get 1 JoinAction claim', () =>
     request(Server)
     .get('/api/claim?claimType=JoinAction')
     .set('Authorization', 'Bearer ' + pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.body[0])
       .that.does.not.have.property('hashNonce')
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

  it('should get 1 confirmation', () =>
     request(Server)
     .get('/api/claim?claimType=AgreeAction')
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
      .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
    .set('Authorization', 'Bearer ' + pushTokens[0])
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
    .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(6)
       expect(r.status).that.equals(200)
     })
  ).timeout(3000)

})

describe('1 - Peer DID', () => {

  it('should register peer DID user', () =>
    request(Server)
    .post('/api/claim')
    .send({"jwtEncoded": registerPeerBy0JwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.a('string')
      expect(r.status).that.equals(201)
    })
  ).timeout(5000)

  it('should fail to create a Give with a peer DID and a bad signature', () =>
    request(Server)
    .post('/api/claim')
    .send({jwtEncoded: pizzaGivePeerBadSigJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(400)
    })
  ).timeout(5000)

  it('should fail to create a Give with a peer DID and missing exp', () =>
    request(Server)
    .post('/api/claim')
    .send({jwtEncoded: pizzaGivePeerMissingExpJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(400)
    })
  ).timeout(5000)

  it('should fail to create a Give with a peer DID and mismatched exp', () =>
    request(Server)
    .post('/api/claim')
    .send({jwtEncoded: pizzaGivePeerMismatchedExpJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(400)
    })
  ).timeout(5000)

  it('should fail to create a Give with a peer DID and mismatched iss', () =>
    request(Server)
    .post('/api/claim')
    .send({jwtEncoded: pizzaGivePeerMismatchedIssJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(400)
    })
  ).timeout(5000)

  it('should create a Give with a peer DID', () =>
    request(Server)
    .post('/api/claim')
    .send({jwtEncoded: pizzaGivePeerJwtEnc})
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.a('string')
      expect(r.status).that.equals(201)
    })
  ).timeout(5000)

})

describe('1 - Action', () => {

  it('should get action with the right properties', () =>
     request(Server)
     .get('/api/action/1')
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .post('/api/report/canSeeMe')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.success).that.equals(false)
     })
  ).timeout(3000)

  it('should get action with the DID hidden', () =>
     request(Server)
     .get('/api/action/1')
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
      .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
      .send({"jwtEncoded": registerBy0JwtEncs[12]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it ('should create a tenure', () =>
      request(Server)
      .post('/api/claim')
      .send({"jwtEncoded": claimCornerBakeryTenureFor12By12JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should get 1 claim', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
      })
  ).timeout(3000)

  it('should get claims from other tests but cannot see inside any', () =>
     request(Server)
     .get('/api/claim')
     .set('Authorization', 'Bearer ' + pushTokens[2])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.an('array')
       let countTwoVisible = 0;
       for (let i = 0; i < r.body.length; i++) {
         if (inputContainsDid(r.body[i], creds[2].did)) {
           expect(inputContainsDid(r.body[i], HIDDEN_TEXT)).to.be.false
           expect(r.body[i].claimType).to.equal("RegisterAction")
           countTwoVisible++
         } else {
           expect(testUtil.allDidsAreHidden(r.body[i], creds[2].did)).to.be.true
         }
       }
       // #2 should only see their registration claim
       expect(countTwoVisible).to.equal(1)
       expect(r.status).that.equals(200)
     }))

  it('should register user 11', () =>
    request(Server)
      .post('/api/claim')
      .send({"jwtEncoded": registerBy0JwtEncs[11]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should create a new tenure', () =>
     request(Server)
     .post('/api/claim')
     .send({ "jwtEncoded": claimCornerBakeryTenureFor11By11JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get claims and can see inside the most recent but cannot see inside the oldest', () =>
     request(Server)
     .get('/api/claim')
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({"jwtEncoded": registerBy0JwtEncs[10]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      })).timeout(5000)

  it('should confirm that competing tenure', () =>
     request(Server)
     .post('/api/claim')
     .send({ "jwtEncoded": confirmCornerBakeryTenureFor11By10JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get 2 tenure claims', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .set('Authorization', 'Bearer ' + pushTokens[0])
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
     .send({ "jwtEncoded": confirmFoodPantryFor4By1JwtEnc })
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should get issuer and confirmer (even though confirmed claim format is different)', () =>
     request(Server)
     .get('/api/report/issuersWhoClaimedOrConfirmed?claimId=' + foodPantryClaimBy4Id)
     .set('Authorization', 'Bearer ' + pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.result)
         .to.be.an('array')
         .of.length(2)
       expect(r.status).that.equals(200)
     })).timeout(3000)


  it('#4 should not be able to set invisible to #4', () =>
    request(Server)
    .post('/api/report/cannotSeeMe')
    .send({ "did": creds[4].did })
    .set('Authorization', 'Bearer ' + pushTokens[4])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body.success).that.equals(false)
    })).timeout(3000)

  //// Now #4 will toggle visibility from #5.

  it('#5 should not see #4', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set('Authorization', 'Bearer ' + pushTokens[5])
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
     .set('Authorization', 'Bearer ' + pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
     }))

  it('unregistered #16 should set visible to unregistered #17', () =>
    request(Server)
    .post('/api/report/canSeeMe')
    .send({ "did": creds[17].did })
    .set('Authorization', 'Bearer ' + pushTokens[16])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.status).that.equals(200)
    }))

  it('#5 should see #4', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set('Authorization', 'Bearer ' + pushTokens[5])
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
     .set('Authorization', 'Bearer ' + pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.true
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#5 should get claims involving #4', () =>
    request(Server)
    .get('/api/v2/report/claims?claimContents=' + encodeURIComponent(creds[4].did))
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body.data).to.have.length(3)
      expect(r.status).that.equals(200)
    })).timeout(3000)

  it('#4 should set invisible to #5', () =>
     request(Server)
     .post('/api/report/cannotSeeMe')
     .send({ "did": creds[5].did })
     .set('Authorization', 'Bearer ' + pushTokens[4])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
     })).timeout(3000)

  it('#5 should not see #4 again', () =>
     request(Server)
     .get('/api/report/whichDidsICanSee')
     .set('Authorization', 'Bearer ' + pushTokens[5])
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
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body.issuer).to.equal(HIDDEN_TEXT)
      expect(r.body.claim.party.identifier).to.equal(HIDDEN_TEXT)
      expect(r.status).that.equals(200)
    })).timeout(3000)

  it('#5 should not get claims searching for #4', () =>
    request(Server)
    .get('/api/v2/report/claims?claimContents=' + encodeURIComponent(creds[4].did))
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body.data).to.have.length(0)
      expect(r.status).that.equals(200)
    })).timeout(3000)

  let foodPantryBy4ConfirmedBy2Id

  it('#2 can confirm #4 tenure for the Food Pantry (even though #4 does not allow visibility)', () =>
    request(Server)
    .post('/api/claim')
    .send({ "jwtEncoded": confirmFoodPantryFor4By2JwtEnc })
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.a('string')
      foodPantryBy4ConfirmedBy2Id = r.body
      expect(r.status).that.equals(201)
    })).timeout(5000)

  it('#2 can get claim and see inside all details since they made that claim, even though #4 restricted visibility', () =>
    request(Server)
    .get('/api/claim/' + foodPantryBy4ConfirmedBy2Id)
    .set('Authorization', 'Bearer ' + pushTokens[2])
    //.expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.be.an('object')
      expect(testUtil.anyDidIsHidden(r.body)).to.be.false
      expect(r.status).that.equals(200)
    }))

})

describe('1 - Transitive Connections', () => {

  let prevConfirmClaimIdBy1
  it('should claim attendance for 1', () =>
     request(Server)
     .post('/api/v2/claim')
     .send({"jwtEncoded": claimIIW2019aFor1By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.success.claimId).to.be.a('string')
       prevConfirmClaimIdBy1 = r.body.success.claimId
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should claim attendance for 2', () =>
     request(Server)
     .post('/api/v2/claim')
     .send({"jwtEncoded": claimIIW2019aFor2By2JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.success.claimId).to.be.a('string')
       expect(r.status).that.equals(201)
     })).timeout(5000)

  let prevConfirmClaimIdByAnyone
  it('should confirm attendance for 1 by 0', () =>
     request(Server)
     .post('/api/v2/claim')
     .send({"jwtEncoded": confirmIIW2019aFor1By0JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.success.claimId).to.be.a('string')
       prevConfirmClaimIdByAnyone = r.body.success.claimId
       expect(r.status).that.equals(201)
     })).timeout(5000)

  let latestClaimId, latestHashNonce
  it('should confirm attendance for 2 by 1', () =>
     request(Server)
     .post('/api/v2/claim')
     .send({"jwtEncoded": confirmIIW2019aFor2By1JwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body.success.claimId).to.be.a('string')
       latestClaimId = r.body.success.claimId
       latestHashNonce = r.body.success.hashNonce
       expect(r.status).that.equals(201)
     })).timeout(5000)

  it('should set the hashes in the chain', () =>
    request(Server)
    .post('/api/util/updateHashChain')
    .then(r => {
      expect(r.body)
      .that.has.a.property('data')
      const data = r.body.data
      expect(data).that.has.a.property('count').that.equals(28)
      expect(data).that.has.a.property('lastNoncedHashAllChain').that.is.not.empty
    })
  )

  it('should validate the nonced hash chains', async () => {
    let twoPrevNoncedHashAllChain, twoPrevNoncedHashIssuerChain,
      latestNoncedHashAllChain, latestNoncedHashIssuerChain

    await request(Server)
    .get('/api/claim/full/' + prevConfirmClaimIdBy1)
    .set('Authorization', 'Bearer ' + pushTokens[0])
    .expect('Content-Type', /json/)
    .then(r => {
      twoPrevNoncedHashIssuerChain = r.body.noncedHashIssuerChain
      expect(r.status).that.equals(200)
    })

    await request(Server)
    .get('/api/claim/full/' + prevConfirmClaimIdByAnyone)
    .set('Authorization', 'Bearer ' + pushTokens[0])
    .expect('Content-Type', /json/)
    .then(r => {
      twoPrevNoncedHashAllChain = r.body.noncedHashAllChain
      expect(r.status).that.equals(200)
    })

    await request(Server)
    .get('/api/claim/full/' + latestClaimId)
    .set('Authorization', 'Bearer ' + pushTokens[1])
    .expect('Content-Type', /json/)
    .then(r => {
      latestNoncedHashAllChain = r.body.noncedHashAllChain
      latestNoncedHashIssuerChain = r.body.noncedHashIssuerChain
      expect(r.status).that.equals(200)
    })

    const latestClaim = confirmIIW2019aFor2By1JwtObj.claim
    const latestIssuerDid = creds[1].did
    // get the issued time from the JWT
    const latestJwt =
      confirmIIW2019aFor2By1JwtEnc.substring(confirmIIW2019aFor2By1JwtEnc.indexOf('.') + 1, confirmIIW2019aFor2By1JwtEnc.lastIndexOf('.'))
    const latestPayload = JSON.parse(Buffer.from(latestJwt, 'base64').toString())
    const latestIat = latestPayload.iat

    const nonceAndClaimEtc = {
      nonce: latestHashNonce,
      claimStr: JSON.stringify(latestClaim),
      issuedAt: latestIat,
      issuerDid: latestIssuerDid,
    }

    /**
     *

    // Here is the manual calculation
    const didNonceHashed1 = "did:none:noncedhashed:" + crypto.createHash('sha256').update(creds[1].did + latestHashNonce).digest('hex')
    const didNonceHashed2 = "did:none:noncedhashed:" + crypto.createHash('sha256').update(creds[2].did + latestHashNonce).digest('hex')
    console.log('didNonceHashed1', didNonceHashed1)
    console.log('didNonceHashed2', didNonceHashed2)
    const latestClaimWithNonces = R.clone(latestClaim)
    latestClaimWithNonces.object = [
      { ...latestClaimWithNonces.object[0], agent: { identifier: didNonceHashed2 } },
    ]
    console.log('latestClaimWithNonces', latestClaimWithNonces, latestClaimWithNonces.object[0].agent.identifier)
    const claimNonced = canonicalize({"claim":latestClaimWithNonces,"issuedAt":latestIat,"issuerDid":didNonceHashed1})
    console.log('claimNonced', claimNonced)
    const claimNoncedHashed = crypto.createHash('sha256').update(claimNonced).digest('base64url')
    console.log('claimNoncedHashed', claimNoncedHashed)
    const latestNoncedHashAllChainCalculated = crypto.createHash('sha256').update(twoPrevNoncedHashAllChain + claimNoncedHashed).digest('base64url')
    console.log('latestNoncedHashAllChainCalculated', latestNoncedHashAllChainCalculated)

     *
     */

    const currentAllChain = nonceHashChain(twoPrevNoncedHashAllChain, [nonceAndClaimEtc])
    expect(currentAllChain).to.equal(latestNoncedHashAllChain)
    const currentIssuerChain = nonceHashChain(twoPrevNoncedHashIssuerChain, [nonceAndClaimEtc])
    expect(currentIssuerChain).to.equal(latestNoncedHashIssuerChain)

  })

})
