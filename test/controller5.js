
// Tests for Registration

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import { DateTime } from "luxon";
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../dist'
import { dbService } from '../dist/api/services/endorser.db.service'
import testUtil from './util'

chai.use(chaiAsPromised);
const expect = chai.expect

const creds = testUtil.ethrCredData

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)

const register13By0JwtObj = R.clone(testUtil.jwtTemplate)
register13By0JwtObj.claim = R.clone(testUtil.registrationTemplate)
register13By0JwtObj.claim.agent.identifier = creds[0].did
register13By0JwtObj.claim.participant.identifier = creds[13].did
register13By0JwtObj.iss = creds[0].did
register13By0JwtObj.sub = creds[13].did
const register13By0JwtProm = credentials[0].createVerification(register13By0JwtObj)

const register12By1JwtObj = R.clone(testUtil.jwtTemplate)
register12By1JwtObj.claim = R.clone(testUtil.registrationTemplate)
register12By1JwtObj.claim.agent.did = creds[1].did
register12By1JwtObj.claim.participant.did = creds[12].did
register12By1JwtObj.iss = creds[1].did
register12By1JwtObj.sub = creds[12].did
const register12By1JwtProm = credentials[1].createVerification(register12By1JwtObj)

const register13By1JwtObj = R.clone(testUtil.jwtTemplate)
register13By1JwtObj.claim = R.clone(testUtil.registrationTemplate)
register13By1JwtObj.claim.agent.did = creds[1].did
register13By1JwtObj.claim.participant.did = creds[13].did
register13By1JwtObj.iss = creds[1].did
register13By1JwtObj.sub = creds[13].did
const register13By1JwtProm = credentials[1].createVerification(register13By1JwtObj)

const claimAnotherBy0JwtObj = R.clone(testUtil.jwtTemplate)
claimAnotherBy0JwtObj.claim = R.clone(testUtil.claimCornerBakery)
const claimAnotherBy0JwtProm = credentials[0].createVerification(claimAnotherBy0JwtObj)

let pushTokens, register13By0JwtEnc, register12By1JwtEnc, register13By1JwtEnc, claimAnotherBy0JwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller5 push tokens", pushTokens)
    })

  await Promise.all([register13By0JwtProm, register12By1JwtProm, register13By1JwtProm, claimAnotherBy0JwtProm])
    .then((jwts) => { [register13By0JwtEnc, register12By1JwtEnc, register13By1JwtEnc, claimAnotherBy0JwtEnc] = jwts })

  return Promise.resolve()

})

describe('5 - Registration', () => {

  it('check that User 0 cannot insert too many registrations', async () => {
    // first, bump up claims so that it doesn't get caught by claims limit (only reg limit)
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, 123)
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({jwtEncoded: register13By0JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
    // now, reset claims limit
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, 122)
  }).timeout(5000)

  it('check that User 1 cannot register on the same day', async () => {
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: register13By1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
        expect(r.body.error.code).that.equals(testUtil.ERROR_CODES.CANNOT_REGISTER_TOO_SOON)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check that user 13 cannot claim', () =>
    request(Server)
      .get('/api/v2/report/canClaim')
      .set('Authorization', 'Bearer ' + pushTokens[13])
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
  ).timeout(3000)

  it('check that User 0 cannot insert too many claims', async() => {
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({jwtEncoded: claimAnotherBy0JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check that user 12 can claim', () =>
     request(Server)
     .get('/api/v2/report/canClaim')
     .set('Authorization', 'Bearer ' + pushTokens[12])
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
  ).timeout(3000)

  it('check that User 1 can register one the next day', async () => {
    // change User 1's registration to a day ago
    const yesterdayEpoch = DateTime.utc().minus({ month: 1 }).toSeconds()
    dbService.registrationUpdateIssueDateForTests(testUtil.ethrCredData[1].did, yesterdayEpoch)

    // we know user 12 is already registered, so this won't affect state
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: register12By1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('bump up User 0 abilities (since this generated test data is often used on the test server)', async () => {
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, 10000)
    await dbService.registrationUpdateMaxRegsForTests(creds[0].did, 1000)
  }).timeout(3000)

})
