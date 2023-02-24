
// Tests for Projects

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import { HIDDEN_TEXT } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)




const ENTITY_NEW_DESC = 'Edited details for app...'




const planWithoutIdBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithoutIdBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithoutIdBy1JwtObj.claim.agent.identifier = creds[1].did
planWithoutIdBy1JwtObj.iss = creds[1].did
const planWithoutIdBy1JwtProm = credentials[1].createVerification(planWithoutIdBy1JwtObj)

const badPlanBy1JwtObj = R.clone(testUtil.jwtTemplate)
badPlanBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
badPlanBy1JwtObj.claim.agent.identifier = creds[1].did
badPlanBy1JwtObj.claim.identifier = 'SomeNonGlobalID' // disallow internal IDs
badPlanBy1JwtObj.iss = creds[1].did
const badPlanBy1JwtProm = credentials[1].createVerification(badPlanBy1JwtObj)

const planWithExtFullBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithExtFullBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithExtFullBy1JwtObj.claim.agent.identifier = creds[1].did
planWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-id'
planWithExtFullBy1JwtObj.iss = creds[1].did
const planWithExtFullBy1JwtProm = credentials[1].createVerification(planWithExtFullBy1JwtObj)

const planNewBy2JwtObj = R.clone(testUtil.jwtTemplate)
planNewBy2JwtObj.claim = R.clone(testUtil.claimPlanAction)
planNewBy2JwtObj.claim.agent.identifier = creds[2].did
planNewBy2JwtObj.claim.description = '#2 Has A Plan'
planNewBy2JwtObj.iss = creds[2].did
const planNewBy2JwtProm = credentials[2].createVerification(planNewBy2JwtObj)





const projectWithoutIdBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectWithoutIdBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectWithoutIdBy1JwtObj.claim.agent.identifier = creds[1].did
projectWithoutIdBy1JwtObj.iss = creds[1].did
const projectWithoutIdBy1JwtProm = credentials[1].createVerification(projectWithoutIdBy1JwtObj)

const badProjectBy1JwtObj = R.clone(testUtil.jwtTemplate)
badProjectBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
badProjectBy1JwtObj.claim.agent.identifier = creds[1].did
badProjectBy1JwtObj.claim.identifier = 'SomeNonGlobalID'
badProjectBy1JwtObj.iss = creds[1].did
const badProjectBy1JwtProm = credentials[1].createVerification(badProjectBy1JwtObj)

const projectWithExtFullBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectWithExtFullBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectWithExtFullBy1JwtObj.claim.agent.identifier = creds[1].did
projectWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-id'
projectWithExtFullBy1JwtObj.iss = creds[1].did
const projectWithExtFullBy1JwtProm = credentials[1].createVerification(projectWithExtFullBy1JwtObj)

const projectNewBy2JwtObj = R.clone(testUtil.jwtTemplate)
projectNewBy2JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectNewBy2JwtObj.claim.agent.identifier = creds[2].did
projectNewBy2JwtObj.claim.description = '#2 Has A Project'
projectNewBy2JwtObj.iss = creds[2].did
const projectNewBy2JwtProm = credentials[2].createVerification(projectNewBy2JwtObj)






const FINAL_SEEKS = "ice cream"

const person1By2JwtObj = R.clone(testUtil.jwtTemplate)
person1By2JwtObj.claim = {
  ... R.clone(testUtil.claimPerson),
  identifier: creds[1].did,
}
const person1By2JwtProm = credentials[2].createVerification(person1By2JwtObj)

const person1By1JwtObj = R.clone(testUtil.jwtTemplate)
person1By1JwtObj.claim = {
  ... R.clone(testUtil.claimPerson),
  identifier: creds[1].did,
  seeks: FINAL_SEEKS,
}
const person1By1JwtProm = credentials[1].createVerification(person1By1JwtObj)

const person1By2AgainFailsJwtObj = R.clone(testUtil.jwtTemplate)
person1By2AgainFailsJwtObj.claim = {
  ... R.clone(testUtil.claimPerson),
  identifier: creds[1].did,
  seeks: "back to stuff",
}
const person1By2AgainFailsJwtProm = credentials[2].createVerification(person1By2AgainFailsJwtObj)




let pushTokens,
    badPlanBy1JwtEnc, planWithoutIdBy1JwtEnc, planWithExtFullBy1JwtEnc,
    planEditBy1JwtEnc, planDupBy2JwtEnc, planNewBy2JwtEnc,
    badProjectBy1JwtEnc, projectWithoutIdBy1JwtEnc, projectWithExtFullBy1JwtEnc,
    projectEditBy1JwtEnc, projectDupBy2JwtEnc, projectNewBy2JwtEnc,
    person1By2JwtEnc, person1By1JwtEnc, person1By2AgainFailsJwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller6 push tokens", pushTokens)
    })

  await Promise.all(
    [
      badPlanBy1JwtProm, planWithoutIdBy1JwtProm, planWithExtFullBy1JwtProm,
      planNewBy2JwtProm,
      badProjectBy1JwtProm, projectWithoutIdBy1JwtProm, projectWithExtFullBy1JwtProm,
      projectNewBy2JwtProm,
      person1By2JwtProm, person1By1JwtProm, person1By2AgainFailsJwtProm
    ]
  )
    .then((jwts) => {
      [
        badPlanBy1JwtEnc, planWithoutIdBy1JwtEnc, planWithExtFullBy1JwtEnc,
        planNewBy2JwtEnc,
        badProjectBy1JwtEnc, projectWithoutIdBy1JwtEnc, projectWithExtFullBy1JwtEnc,
        projectNewBy2JwtEnc,
        person1By2JwtEnc, person1By1JwtEnc, person1By2AgainFailsJwtEnc,
      ] = jwts
    })

  return Promise.resolve()

})

let firstIdExternal

describe('6 - Plans', () => {

  // note that this is similar to Project

  let firstIdInternal

  it('v2 insert plan without ID by first user', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithoutIdBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.body.success.fullIri).to.be.a('string')
        expect(r.body.success.recordsSavedForEdit).to.equal(1)
        firstIdExternal = r.body.success.fullIri
        firstIdInternal = r.body.success.claimId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('access plan without ID by first user, by first ID', () => {
    return request(Server)
      .get('/api/plan/' + firstIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 insert of bad plan by first user', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: badPlanBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
        expect(r.body.error.message).to.be.a('string')
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].fullIri).to.be.a('string')
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access non-existent claim', () => {
    return request(Server)
      .get('/api/claim/byHandle/xyz')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access raw plan claim by first user, by external ID', () => {
    return request(Server)
      .get('/api/claim/byHandle/' + encodeURIComponent(firstIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.issuer).that.equals(creds[1].did)
        expect(r.body.claim.agent.identifier).that.equals(creds[1].did)
        expect(r.body.claim.name).that.equals(testUtil.claimPlanAction.name)
        expect(r.body.claim.description).that.equals(testUtil.claimPlanAction.description)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access plan by first user, by external ID', () => {
    return request(Server)
      .get('/api/plan/' + encodeURIComponent(firstIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access a different plan by first user', () => {
    return request(Server)
      .get('/api/plan/some-incorrect-id')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access plan by public, by internal ID', () => {
    return request(Server)
      .get('/api/plan/' + firstIdInternal)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.fullIri).that.equals(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 insert of plan by second person, by same external ID', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.identifier = firstIdInternal
    planObj.claim.description = ENTITY_NEW_DESC
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('access same plan by second person, by external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + firstIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access same plan by first person, by external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + firstIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access same plan by first person, by full external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + encodeURIComponent(firstIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 update a plan description', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.identifier = firstIdExternal
    planObj.claim.description = ENTITY_NEW_DESC
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('access same plan by first person, still getting initial plan but with new description', () => {
    return request(Server)
      .get('/api/plan/' + firstIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.fullIri).that.equals(firstIdExternal)
        expect(r.body.description).that.equals(ENTITY_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access raw updated plan claim by first user, by external ID', () => {
    return request(Server)
      .get('/api/claim/byHandle/' + encodeURIComponent(firstIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.issuer).that.equals(creds[1].did)
        expect(r.body.claim.agent.identifier).that.equals(creds[1].did)
        expect(r.body.claim.name).that.equals(testUtil.claimPlanAction.name)
        expect(r.body.claim.description).that.equals(ENTITY_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 insert of plan with external ID from different system', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithExtFullBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans again', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[1].fullIri).to.equal(firstIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 insert of second plan by second person', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planNewBy2JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans by first user', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(2)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 retrieve plans by first user starting with #2', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer?beforeId=2')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 retrieve all plans by second user', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})

describe('6 - retrieve offered and given totals', () => {

  it('insert offer', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Groom the horses',
      isPartOf: { '@type': 'PlanAction', identifier: firstIdExternal }
    }
    credObj.claim.offeredBy.identifier = creds[2].did
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer total fails without certain parameters', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?unit=HUR')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer total fails with recipient that does not match issuer', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?recipientId=' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer totals are correct', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?planId=' + firstIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal([{ total: 1, unit: 'HUR'}])
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('find offer in search', () => {
    return request(Server)
      .get('/api/v2/report/offers?claimContents=groom')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].recipientPlanId).that.equals(firstIdExternal)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #2', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Take dogs for a walk',
      isPartOf: { '@type': 'PlanAction', identifier: firstIdExternal }
    }
    credObj.claim.offeredBy.identifier = creds[2].did
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #3', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Feed cats',
      isPartOf: { '@type': 'PlanAction', identifier: firstIdExternal }
    }
    credObj.claim.offeredBy.identifier = creds[3].did
    credObj.sub = creds[3].did
    credObj.iss = creds[3].did
    const claimJwtEnc = await credentials[3].createVerification(credObj)

    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[3])
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer totals are correct after offer #3', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?planId=' + firstIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal([{ total: 4, unit: 'HUR'}])
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offers are correct for multiple projects', () => {
    return request(Server)
      .get(
        '/api/v2/report/offersForPlans?planIds='
          + encodeURIComponent(JSON.stringify([firstIdExternal]))
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  // outstanding offers

  // current gave total
  // recent gave
  // unconfirmed gave
  // confirmed gave
  // given to me
  // given to my projects
  // given to watched projects

})
