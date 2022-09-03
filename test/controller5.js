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

let pushTokens

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      console.log("Created controller5 push tokens", pushTokens)
    })

  return Promise.resolve()
})

describe('Registration', () => {

  it('check that user 12 can claim', () =>
     request(Server)
     .get('/api/reportAll/canClaim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[12])
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

  it('check that user 13 cannot claim', () =>
     request(Server)
     .get('/api/reportAll/canClaim')
     .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[13])
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
