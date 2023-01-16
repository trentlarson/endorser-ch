
// Tests for Projects

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const PLAN_1_INTERNAL_ID = 'park-it-phineas'
const PLAN_1_EXTERNAL_ID = 'https://endorser.ch/plan/park-it-phineas'
const PROJECT_1_INTERNAL_ID = 'park-it-phineas'
const PROJECT_1_EXTERNAL_ID = 'https://endorser.ch/project/park-it-phineas'

const planBy1JwtObj = R.clone(testUtil.jwtTemplate)
planBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planBy1JwtObj.claim.agent.identifier = creds[1].did
planBy1JwtObj.claim.identifier = PLAN_1_INTERNAL_ID
planBy1JwtObj.iss = creds[1].did
const planBy1JwtProm = credentials[1].createVerification(planBy1JwtObj)

const planBy2JwtObj = R.clone(testUtil.jwtTemplate)
planBy2JwtObj.claim = R.clone(testUtil.claimPlanAction)
planBy2JwtObj.claim.agent.identifier = creds[2].did
planBy2JwtObj.claim.identifier = PLAN_1_INTERNAL_ID
planBy2JwtObj.iss = creds[2].did
const planBy2JwtProm = credentials[2].createVerification(planBy2JwtObj)

const projectBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectBy1JwtObj.claim.agent.identifier = creds[1].did
projectBy1JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectBy1JwtObj.iss = creds[1].did
const projectBy1JwtProm = credentials[1].createVerification(projectBy1JwtObj)

const projectBy2JwtObj = R.clone(testUtil.jwtTemplate)
projectBy2JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectBy2JwtObj.claim.agent.identifier = creds[2].did
projectBy2JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectBy2JwtObj.iss = creds[2].did
const projectBy2JwtProm = credentials[2].createVerification(projectBy2JwtObj)

let pushTokens, planBy1JwtEnc, planBy2JwtEnc, projectBy1JwtEnc, projectBy2JwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller5 push tokens", pushTokens)
    })

  await Promise.all([planBy1JwtProm, planBy2JwtProm, projectBy1JwtProm, projectBy2JwtProm])
    .then((jwts) => { [planBy1JwtEnc, planBy2JwtEnc, projectBy1JwtEnc, projectBy2JwtEnc] = jwts })

  return Promise.resolve()

})

describe('6 - Plans', () => {

  it('check insertion of plan by first user', async () => {
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: planBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of plan by first user, by external ID', async () => {
    await request(Server)
      .get('/api/ext/plan/' + PLAN_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of a different plan by first user', async () => {
    await request(Server)
      .get('/api/ext/plan/' + PLAN_1_INTERNAL_ID + '-bad-suffix')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of plan by public, by external ID', async () => {
    await request(Server)
      .get('/api/ext/plan/' + PLAN_1_INTERNAL_ID)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check insertion of plan by second person, by same external ID', async () => {
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: planBy2JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same plan by second person, by external ID, still getting initial plan', async () => {
    await request(Server)
      .get('/api/ext/plan/' + PLAN_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same plan by first person, by external ID, still getting initial plan', async () => {
    await request(Server)
      .get('/api/ext/plan/' + PLAN_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

})

describe('6 - Projects', () => {

  it('check insertion of project by first user', async () => {
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: projectBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of project by first user, by external ID', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of a different project by first user', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID + '-bad-suffix')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of project by public, by external ID', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check insertion of project by second person, by same external ID', async () => {
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: projectBy2JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same project by second person, by external ID, still getting initial project', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same project by first person, by external ID, still getting initial project', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

})
