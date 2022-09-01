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

const claimRegister = {
  "@context": "https://schema.org",
  "@type": "RegisterAction",
  agent: creds[2].did,
  object: creds[8].did,
}

const registrationJwtObj = R.clone(testUtil.jwtTemplate)
registrationJwtObj.claim = R.clone(claimRegister)
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
       expect(r.body.length).to.equal(26)
       expect(r.status).that.equals(201)
     }).catch((err) => {
       return Promise.reject(err)
     })
  )

  it('check that user 8 can claim', () =>
     request(Server)
     .get('/api/reportAll/canClaim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[8])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body).to.be.an('object')
       expect(r.body).that.has.a.property('data')
       expect(r.body.data).to.be.a('boolean')
       expect(r.body.data).to.be.true
     }).catch((err) => {
       return Promise.reject(err)
     })
  )

  it('check that user 9 cannot claim', () =>
     request(Server)
     .get('/api/reportAll/canClaim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[9])
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.status).that.equals(200)
       expect(r.body).to.be.an('object')
       expect(r.body).that.has.a.property('data')
       expect(r.body.data).to.be.a('boolean')
       expect(r.body.data).to.be.false
     }).catch((err) => {
       return Promise.reject(err)
     })
  )

})
