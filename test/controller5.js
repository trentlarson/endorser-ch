import chai from 'chai'
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const claimOffer = {
  "@context": "https://schema.org",
  "@type": "RegisterAction",
  agent: creds[2].did,
  object: creds[8].did,
}

const registrationJwtObj = R.clone(testUtil.jwtTemplate)
registrationJwtObj.claim = R.clone(claimOffer)
const registrationJwtProm = credentials[2].createVerification(registrationJwtObj)

let pushTokens, registrationJwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      console.log("Created controller5 push tokens", pushTokens)
    })

  await Promise.all([ registrationJwtProm ])
    .then((jwts) => {
      [ registrationJwtEnc ] = jwts
      console.log("Created controller5 claim tokens", jwts)
    })

  return Promise.resolve()
})

describe('Registration', () => {

  it('register a user', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[2])
     .send({jwtEncoded: registrationJwtEnc})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body).to.be.a('string')
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
  )

})
