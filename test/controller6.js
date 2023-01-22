
// Tests for Projects

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import {
  GLOBAL_PLAN_ID_IRI_PREFIX, GLOBAL_PROJECT_ID_IRI_PREFIX, HIDDEN_TEXT,
} from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)




const PLAN_1_INTERNAL_ID = 'park-it-phineas'
const PLAN_1_EXTERNAL_ID = 'https://endorser.ch/plan/park-it-phineas'
const PLAN_1_NEW_DESC = 'Edited details for app...'

const planWithoutIdBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithoutIdBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithoutIdBy1JwtObj.claim.agent.identifier = creds[1].did
planWithoutIdBy1JwtObj.iss = creds[1].did
const planWithoutIdBy1JwtProm = credentials[1].createVerification(planWithoutIdBy1JwtObj)

const planBy1JwtObj = R.clone(testUtil.jwtTemplate)
planBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planBy1JwtObj.claim.agent.identifier = creds[1].did
planBy1JwtObj.claim.identifier = PLAN_1_INTERNAL_ID
planBy1JwtObj.iss = creds[1].did
const planBy1JwtProm = credentials[1].createVerification(planBy1JwtObj)

const planWithExtFullBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithExtFullBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithExtFullBy1JwtObj.claim.agent.identifier = creds[1].did
planWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-id'
planWithExtFullBy1JwtObj.iss = creds[1].did
const planWithExtFullBy1JwtProm = credentials[1].createVerification(planWithExtFullBy1JwtObj)

const planBy2JwtObj = R.clone(testUtil.jwtTemplate)
planBy2JwtObj.claim = R.clone(testUtil.claimPlanAction)
planBy2JwtObj.claim.agent.identifier = creds[2].did
planBy2JwtObj.claim.identifier = PLAN_1_INTERNAL_ID
planBy2JwtObj.iss = creds[2].did
const planBy2JwtProm = credentials[2].createVerification(planBy2JwtObj)

const planEditBy1JwtObj = R.clone(testUtil.jwtTemplate)
planEditBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planEditBy1JwtObj.claim.agent.identifier = creds[1].did
planEditBy1JwtObj.claim.identifier = PLAN_1_INTERNAL_ID
planEditBy1JwtObj.claim.description = PLAN_1_NEW_DESC
planEditBy1JwtObj.iss = creds[1].did
const planEditBy1JwtProm = credentials[1].createVerification(planEditBy1JwtObj)




const PROJECT_1_INTERNAL_ID = 'park-it-phineas'
const PROJECT_1_EXTERNAL_ID = 'https://endorser.ch/project/park-it-phineas'
const PROJECT_1_NEW_DESC = 'Edited details for app...'

const projectWithoutIdBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectWithoutIdBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectWithoutIdBy1JwtObj.claim.agent.identifier = creds[1].did
projectWithoutIdBy1JwtObj.iss = creds[1].did
const projectWithoutIdBy1JwtProm = credentials[1].createVerification(projectWithoutIdBy1JwtObj)

const projectBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectBy1JwtObj.claim.agent.identifier = creds[1].did
projectBy1JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectBy1JwtObj.iss = creds[1].did
const projectBy1JwtProm = credentials[1].createVerification(projectBy1JwtObj)

const projectWithExtFullBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectWithExtFullBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectWithExtFullBy1JwtObj.claim.agent.identifier = creds[1].did
projectWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-id'
projectWithExtFullBy1JwtObj.iss = creds[1].did
const projectWithExtFullBy1JwtProm = credentials[1].createVerification(projectWithExtFullBy1JwtObj)

const projectBy2JwtObj = R.clone(testUtil.jwtTemplate)
projectBy2JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectBy2JwtObj.claim.agent.identifier = creds[2].did
projectBy2JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectBy2JwtObj.iss = creds[2].did
const projectBy2JwtProm = credentials[2].createVerification(projectBy2JwtObj)

const projectEditBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectEditBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectEditBy1JwtObj.claim.agent.identifier = creds[1].did
projectEditBy1JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectEditBy1JwtObj.claim.description = PROJECT_1_NEW_DESC
projectEditBy1JwtObj.iss = creds[1].did
const projectEditBy1JwtProm = credentials[1].createVerification(projectEditBy1JwtObj)

let pushTokens,
    planBy1JwtEnc, planWithoutIdBy1JwtEnc, planWithExtFullBy1JwtEnc,
    planBy2JwtEnc, planEditBy1JwtEnc,
    projectBy1JwtEnc, projectWithoutIdBy1JwtEnc, projectWithExtFullBy1JwtEnc,
    projectBy2JwtEnc, projectEditBy1JwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller6 push tokens", pushTokens)
    })

  await Promise.all(
    [
      planBy1JwtProm, planWithoutIdBy1JwtProm, planWithExtFullBy1JwtProm,
      planBy2JwtProm, planEditBy1JwtProm,
      projectBy1JwtProm, projectWithoutIdBy1JwtProm, projectWithExtFullBy1JwtProm,
      projectBy2JwtProm, projectEditBy1JwtProm,
    ]
  )
    .then((jwts) => {
      [
        planBy1JwtEnc, planWithoutIdBy1JwtEnc, planWithExtFullBy1JwtEnc,
        planBy2JwtEnc, planEditBy1JwtEnc,
        projectBy1JwtEnc, projectWithoutIdBy1JwtEnc, projectWithExtFullBy1JwtEnc,
        projectBy2JwtEnc, projectEditBy1JwtEnc,
      ] = jwts
    })

  return Promise.resolve()

})

describe('6 - Plans', () => {

  // note that this is similar to Project

  let firstId = null

  it('check insertion of plan without ID by first user', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithoutIdBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.body.success.embeddedResult.fullIri).to.be.a('string')
        firstId = r.body.success.embeddedResult.fullIri
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of plan without ID by first user, by first ID', async () => {
    const internalId = firstId.substring(GLOBAL_PLAN_ID_IRI_PREFIX.length)
    await request(Server)
      .get('/api/plan/' + internalId)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(internalId)
        expect(r.body.fullIri).that.equals(firstId)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of plan by first user', async () => {
    await request(Server)
      .post('/api/v2/claim')
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
      .get('/api/plan/' + PLAN_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of a different plan by first user', async () => {
    await request(Server)
      .get('/api/plan/' + PLAN_1_INTERNAL_ID + '-bad-suffix')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check access of plan by public, by external ID', async () => {
    await request(Server)
      .get('/api/plan/' + PLAN_1_INTERNAL_ID)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of plan by second person, by same external ID', async () => {
    await request(Server)
      .post('/api/v2/claim')
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
      .get('/api/plan/' + PLAN_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of same plan by first person, by external ID, still getting initial plan', async () => {
    await request(Server)
      .get('/api/plan/' + PLAN_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of same plan by first person, by full external ID, still getting initial plan', async () => {
    await request(Server)
      .get('/api/plan/' + encodeURIComponent(PLAN_1_EXTERNAL_ID))
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
  }).timeout(3000)

  it('update a plan description', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planEditBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same plan by first person, still getting initial plan but with new description', async () => {
    await request(Server)
      .get('/api/plan/' + PLAN_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PLAN_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PLAN_1_EXTERNAL_ID)
        expect(r.body.description).that.equals(PLAN_1_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of plan with external ID from different system', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithExtFullBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('retrieve all plans', async () => {
    await request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.body.data[0].internalId).to.be.null
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})

describe('6 - Projects', () => {

  // note that this is similar to PlanAction

  let firstId = null

  it('check insertion of project without ID by first user', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: projectWithoutIdBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.body.success.embeddedResult.fullIri).to.be.a('string')
        firstId = r.body.success.embeddedResult.fullIri
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of project without ID by first user, by first ID', async () => {
    const internalId = firstId.substring(GLOBAL_PROJECT_ID_IRI_PREFIX.length)
    await request(Server)
      .get('/api/project/' + internalId)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(internalId)
        expect(r.body.fullIri).that.equals(firstId)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of project by first user', async () => {
    await request(Server)
      .post('/api/v2/claim')
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
      .get('/api/project/' + PROJECT_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of a different project by first user', async () => {
    await request(Server)
      .get('/api/project/' + PROJECT_1_INTERNAL_ID + '-bad-suffix')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check access of project by public, by external ID', async () => {
    await request(Server)
      .get('/api/project/' + PROJECT_1_INTERNAL_ID)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of project by second person, by same external ID', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: projectBy2JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('retrieve all projects xxxxxxxxxxxx', async () => {
    await request(Server)
      .get('/api/v2/report/projects')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(2)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check access of same project by second person, by external ID, still getting initial project', async () => {
    await request(Server)
      .get('/api/project/' + PROJECT_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of same project by first person, by external ID, still getting initial project', async () => {
    await request(Server)
      .get('/api/project/' + PROJECT_1_INTERNAL_ID)
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
  }).timeout(3000)

  it('check access of same project by first person, by full external ID, still getting initial project', async () => {
    await request(Server)
      .get('/api/project/' + encodeURIComponent(PROJECT_1_EXTERNAL_ID))
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
  }).timeout(3000)

  it('update a project description', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: projectEditBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of same project by first person, still getting initial project but with new description', async () => {
    await request(Server)
      .get('/api/project/' + PROJECT_1_INTERNAL_ID)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
        expect(r.body.description).that.equals(PROJECT_1_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('check insertion of project with external ID from different system', async () => {
    await request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: projectWithExtFullBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('retrieve all projects', async () => {
    await request(Server)
      .get('/api/v2/report/projects')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.body.data[0].internalId).to.be.null
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})
