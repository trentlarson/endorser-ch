import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import dbService from '../server/api/services/endorser.db.service'
import { UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

chai.use(chaiAsPromised);
const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const registerAnotherBy0JwtObj = R.clone(testUtil.jwtTemplate)
registerAnotherBy0JwtObj.claim = R.clone(testUtil.registrationTemplate)
registerAnotherBy0JwtObj.claim.agent.did = creds[0].did
registerAnotherBy0JwtObj.claim.participant.did = creds[13].did
registerAnotherBy0JwtObj.iss = creds[0].did
registerAnotherBy0JwtObj.sub = creds[13].did
const registerAnotherBy0JwtProm = credentials[0].createVerification(registerAnotherBy0JwtObj)
console.log('registerAnotherBy0JwtProm',registerAnotherBy0JwtProm)

const claimAnotherBy0JwtObj = R.clone(testUtil.jwtTemplate)
claimAnotherBy0JwtObj.claim = R.clone(testUtil.claimCornerBakery)
const claimAnotherBy0JwtProm = credentials[0].createVerification(claimAnotherBy0JwtObj)

let pushTokens, registerAnotherBy0JwtEnc, claimAnotherBy0JwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      console.log("Created controller5 push tokens", pushTokens)
    })

  await Promise.all([registerAnotherBy0JwtProm, claimAnotherBy0JwtProm])
    .then((jwts) => { [registerAnotherBy0JwtEnc, claimAnotherBy0JwtEnc] = jwts })

  return Promise.resolve()

})

describe('Registration', () => {

  it('check that cannot insert too many registrations', async () => {
    // bump up claims so that it doesn't get caught by claims limit (only reg limit)
    await dbService.registrationUpdateMaxClaims(creds[0].did, 123)
    await request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({jwtEncoded: registerAnotherBy0JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
    await dbService.registrationUpdateMaxClaims(creds[0].did, 122)
  }).timeout(3001)

  it('check that cannot insert too many claims', async() => {
    return request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({jwtEncoded: claimAnotherBy0JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3001)

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
