
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

  let prevMaxClaims, prevMaxRegs
  it('check that User 0 cannot insert too many registrations', async () => {

    // save current max claims for restoration later
    const claimLimits = await new Promise((resolve, reject) =>
      request(Server)
        .get('/api/report/rateLimits')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.headers['content-type'], /json/)
          expect(r.status).that.equals(200)
          resolve(r.body)
        })
        .catch(err => reject(err))
    )
    prevMaxClaims = claimLimits.maxClaimsPerWeek
    prevMaxRegs = claimLimits.maxRegistrationsPerWeek

    await dbService.registrationUpdateMaxRegsForTests(creds[0].did, 13)
    // bump up claims so that it doesn't get caught by claims limit (only reg limit)
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, 123)
    // now, try to register
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

    // try an invite
    const registerUnknownBy0Obj = R.clone(testUtil.jwtTemplate)
    registerUnknownBy0Obj.claim = R.clone(testUtil.registrationTemplate)
    registerUnknownBy0Obj.claim.agent.identifier = creds[0].did
    delete registerUnknownBy0Obj.participant
    const identifier =
      Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2);
    registerUnknownBy0Obj.claim.identifier = identifier
    const registerUnknownBy0Enc = await credentials[0].createVerification(registerUnknownBy0Obj)
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ jwtEncoded: registerUnknownBy0Enc })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
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
    const yesterdayEpoch = DateTime.utc().minus({day: 1}).toSeconds()
    const prevEpoch = (await dbService.registrationByDid(creds[1].did)).epoch
    dbService.registrationUpdateIssueDateForTests(testUtil.ethrCredData[1].did, yesterdayEpoch)

    // we know user 12 is already registered, so this won't affect state
    return await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: register12By1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      }).finally(() => {
        // restore registration date
        dbService.registrationUpdateIssueDateForTests(testUtil.ethrCredData[1].did, prevEpoch)
      })
  }).timeout(3000)

  it('reset claim limits', async () => {
    // now, reset claims limit
    await dbService.registrationUpdateMaxClaimsForTests(creds[0].did, prevMaxClaims)
    await dbService.registrationUpdateMaxRegsForTests(creds[0].did, prevMaxRegs)
  })

})
