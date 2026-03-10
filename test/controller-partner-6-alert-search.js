// Tests for partner alertSearch (profiles only)
// Depends on controller-partner-1-profile creating profiles with location

import chai from 'chai'
import R from 'ramda'
import request from 'supertest'
import { ulid } from 'ulidx'

import Server from '../dist'
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new (require('uport-credentials').Credentials)(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens

before(async () => {
  await Promise.all(pushTokenProms).then((jwts) => { pushTokens = jwts })
  return Promise.resolve()
})

describe('P6 - Alert Search partner', () => {

  it('partner alertSearch requires auth', () => {
    return request(Server)
      .post('/api/partner/alertSearch')
      .send({})
      .then((r) => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.include('Authorization')
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch returns 200 with profilesNearby structure', () => {
    return request(Server)
      .get('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then((r) => {
        console.log('r.body', r.body)
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body.data).to.have.property('profilesNearby').that.is.an('array')
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch without location returns empty profilesNearby', () => {
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({})
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby).to.be.an('array')
        expect(r.body.data.profilesNearby.length).to.equal(0)
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch with location returns profiles in bbox', () => {
    // Profile locations from controller-partner-1: profile1 (40.7128, -74.0060), profile2 (40.7138, -74.0070)
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({
        location: {
          minLocLat: 40.7120,
          maxLocLat: 40.7150,
          minLocLon: -74.0080,
          maxLocLon: -74.0050,
        },
      })
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby).to.be.an('array')
        expect(r.body.data.profilesNearby.length).to.be.at.least(1)
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch with afterId and location filters by date', () => {
    // Use a very old afterId (epoch) to get all profiles
    const epochUlid = '00000000000000000000000000'
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({
        afterId: epochUlid,
        location: {
          minLocLat: 40.7120,
          maxLocLat: 40.7150,
          minLocLon: -74.0080,
          maxLocLon: -74.0050,
        },
      })
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby).to.be.an('array')
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch with afterDate and beforeDate filters by date range', () => {
    // Use ISO date strings instead of ULIDs; afterDate/beforeDate take precedence
    const afterDateIso = new Date(Date.now() - 86400000 * 7).toISOString() // 7 days ago
    const beforeDateIso = new Date(Date.now() + 86400000).toISOString() // 1 day from now
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({
        afterDate: afterDateIso,
        beforeDate: beforeDateIso,
        location: {
          minLocLat: 40.7120,
          maxLocLat: 40.7150,
          minLocLon: -74.0080,
          maxLocLon: -74.0050,
        },
      })
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby).to.be.an('array')
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch invalid planHandleIds adds userMessage but continues', () => {
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ planHandleIds: 123 })
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby).to.be.an('array')
        expect(r.body).to.have.property('userMessage')
        expect(r.body.userMessage).to.include('array')
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch count increases by 1 after new profile in bbox', () => {
    // pushTokens[5] has no profile in P1; P4 enables embedding only for 1-4, so no embedding row
    const location = {
      minLocLat: 40.7120,
      maxLocLat: 40.7150,
      minLocLon: -74.0080,
      maxLocLon: -74.0050,
    }
    const afterId = ulid(Date.now() - 5000)
    let countBefore
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ location, afterId })
      .then((r) => {
        expect(r.status).to.equal(200)
        countBefore = r.body.data.profilesNearby.length
      })
      .then(() =>
        request(Server)
          .post('/api/partner/userProfile')
          .set('Authorization', 'Bearer ' + pushTokens[5])
          .send({
            description: 'Community organizer interested in local food systems',
            locLat: 40.7125,
            locLon: -74.0065,
          })
      )
      .then((r) => {
        expect(r.status).to.equal(201)
      })
      .then(() =>
        request(Server)
          .post('/api/partner/alertSearch')
          .set('Authorization', 'Bearer ' + pushTokens[0])
          .send({ location, afterId })
      )
      .then((r) => {
        expect(r.status).to.equal(200)
        const countAfter = r.body.data.profilesNearby.length
        expect(countAfter).to.equal(countBefore + 1)
      })
      .catch((err) => Promise.reject(err))
  })

  it('partner alertSearch count increases by 1 after update to existing profile (which fails without OPENAI_API_KEY)', () => {
    // profile1 (pushTokens[1]); no embedding row when P4 not run; use empty desc if 500
    const location = {
      minLocLat: 40.7120,
      maxLocLat: 40.7150,
      minLocLon: -74.0080,
      maxLocLon: -74.0050,
    }
    const afterId = ulid(Date.now() - 2000)
    let countBefore
    return request(Server)
      .post('/api/partner/alertSearch')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ location, afterId })
      .then((r) => {
        expect(r.status).to.equal(200)
        countBefore = r.body.data.profilesNearby.length
      })
      .then(() =>
        request(Server)
          .post('/api/partner/userProfile')
          .set('Authorization', 'Bearer ' + pushTokens[1])
          .send({
            description: 'Urban farmer – updated for alertSearch test',
            locLat: 40.7128,
            locLon: -74.0060,
          })
      )
      .then((r) => {
        expect(r.status).to.equal(201)
      })
      .then(() =>
        request(Server)
          .post('/api/partner/alertSearch')
          .set('Authorization', 'Bearer ' + pushTokens[0])
          .send({ location, afterId })
      )
      .then((r) => {
        expect(r.status).to.equal(200)
        expect(r.body.data.profilesNearby.length).to.equal(countBefore + 1)
      })
      .catch((err) => Promise.reject(err))
  })

})
