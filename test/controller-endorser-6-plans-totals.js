
// Tests for Projects

import chai from 'chai'
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../dist'
import {
  findAllLastClaimIdsAndHandleIds,
  HIDDEN_TEXT,
  globalId,
  localFromGlobalEndorserIdentifier,
} from '../src/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.ethrCredData

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)




const ENTITY_NEW_DESC = 'Edited details for app...'
const ENTITY_NEW_DESC_2 = 'Edited details again for app...'




const planBy2FulfillsBy1Claim = R.clone(testUtil.claimPlanAction)
planBy2FulfillsBy1Claim.agent.identifier = creds[2].did
planBy2FulfillsBy1Claim.name = planBy2FulfillsBy1Claim.name + " - taco worthy"
planBy2FulfillsBy1Claim.description = "I'll make a taco for the effort."
planBy2FulfillsBy1Claim.fulfills = {
  "@type": "PlanAction",
  //"identifier": null // will be supplied later
}




const planWithoutIdBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithoutIdBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithoutIdBy1JwtObj.claim.agent.identifier = creds[1].did
planWithoutIdBy1JwtObj.claim.name = planWithoutIdBy1JwtObj.claim.name + " - overwritten"
planWithoutIdBy1JwtObj.iss = creds[1].did
const planWithoutIdBy1JwtProm = credentials[1].createVerification(planWithoutIdBy1JwtObj)

const badPlanBy1JwtObj = R.clone(testUtil.jwtTemplate)
badPlanBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
badPlanBy1JwtObj.claim.agent.identifier = creds[1].did
badPlanBy1JwtObj.claim.identifier = 'SomeNonGlobalID' // disallow internal IDs
badPlanBy1JwtObj.claim.name = badPlanBy1JwtObj.claim.name + " - bad"
badPlanBy1JwtObj.iss = creds[1].did
const badPlanBy1JwtProm = credentials[1].createVerification(badPlanBy1JwtObj)

const planWithExtFullBy1JwtObj = R.clone(testUtil.jwtTemplate)
planWithExtFullBy1JwtObj.claim = R.clone(testUtil.claimPlanAction)
planWithExtFullBy1JwtObj.claim.agent.identifier = creds[1].did
planWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-plan-id'
planWithExtFullBy1JwtObj.claim.name = planWithExtFullBy1JwtObj.claim.name + " - external"
planWithExtFullBy1JwtObj.iss = creds[1].did
const planWithExtFullBy1JwtProm = credentials[1].createVerification(planWithExtFullBy1JwtObj)

const planNewBy2JwtObj = R.clone(testUtil.jwtTemplate)
planNewBy2JwtObj.claim = R.clone(testUtil.claimPlanAction)
planNewBy2JwtObj.claim.agent.identifier = creds[2].did
planNewBy2JwtObj.claim.description = '#2 Has A Plan'
planNewBy2JwtObj.claim.name = planNewBy2JwtObj.claim.name + " - by #2"
planNewBy2JwtObj.iss = creds[2].did
planNewBy2JwtObj.claim.location.geo.latitude += 0.1
planNewBy2JwtObj.claim.location.geo.longitude += 0.1
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
projectWithExtFullBy1JwtObj.claim.identifier = 'scheme://from-somewhere/with-some-project-id'
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
    planBy2FulfillsBy1JwtEnc,
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

let firstPlanIdExternal, firstPlanIdInternal,
  firstPlanClaim2IdInternal,
  secondPlanIdExternal, secondPlanIdInternal,
  planBy2FulfillsBy1Claim1IdExternal, planBy2FulfillsBy1Claim1IdInternal,
  planBy2FulfillsBy1Claim2IdInternal,
  planBy2FulfillsBy1Claim3IdInternal

describe('6 - Plans', () => {

  // note that this is similar to Project

  let planEndTime

  it('v2 insert plan without ID by first user', () => {
    planEndTime = new Date(planWithoutIdBy1JwtObj.claim.endTime)
    planEndTime.setMilliseconds(0)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithoutIdBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.body.success.recordsSavedForEdit).to.equal(1)
        firstPlanIdExternal = r.body.success.handleId
        firstPlanIdInternal = r.body.success.claimId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('access plan without ID by first user, by first ID', () => {
    return request(Server)
      .get('/api/plan/' + firstPlanIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
        expect(r.body.locLat).that.equals(testUtil.claimPlanAction.location.geo.latitude)
        expect(r.body.locLon).that.equals(testUtil.claimPlanAction.location.geo.longitude)
        expect(r.body.url).that.equals("https://example.com/plan/111")
        const dbTime = new Date(r.body.endTime)
        expect(dbTime.getTime()).that.equals(planEndTime.getTime())
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('fail to retrieve plan without matching a location', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
      .get('/api/v2/report/plansByLocation'
        + '?minLocLat' + '=' + (lat + 1)
        + '&maxLocLat' + '=' + (lat + 2)
        + '&westLocLon' + '=' + (lon + 1)
        + '&eastLocLon' + '=' + (lon + 2)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data?.length).that.equals(0)
      }).catch((err) => {
        return Promise.reject(err)
      })
  })

  it('retrieve one plan with matching a location', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
      .get('/api/v2/report/plansByLocation'
        + '?minLocLat' + '=' + (lat - 1)
        + '&maxLocLat' + '=' + (lat + 1)
        + '&westLocLon' + '=' + (lon - 1)
        + '&eastLocLon' + '=' + (lon + 1)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data?.length).that.equals(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  })

  it('v2 insert of bad plan by first user', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: badPlanBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
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
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].handleId).to.be.a('string')
        expect(r.body.data[0].rowId).to.be.a('number')
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
      .get('/api/claim/byHandle/' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.issuer).that.equals(creds[1].did)
        expect(r.body.claim.agent.identifier).that.equals(creds[1].did)
        expect(r.body.claim.name).that.equals(planWithoutIdBy1JwtObj.claim.name)
        expect(r.body.claim.description).that.equals(testUtil.claimPlanAction.description)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access plan by first user, by external ID', () => {
    return request(Server)
      .get('/api/plan/' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
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
      .get('/api/plan/' + firstPlanIdInternal)
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(HIDDEN_TEXT)
        expect(r.body.issuerDid).that.equals(HIDDEN_TEXT)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
      }).catch(
        (err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve no plan counts inside bounding box', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
      .get('/api/v2/report/planCountsByBBox'
        + '?minLocLat' + '=' + (lat - 0.1)
        + '&maxLocLat' + '=' + (lat + 1)
        + '&westLocLon' + '=' + (lon - 0.1)
        + '&eastLocLon' + '=' + (lon + 1)
      )
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.tiles.length).that.equals(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  })

  it('v2 insert of plan by second person, by same ID', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.lastClaimId = firstPlanIdInternal
    planObj.claim.description = ENTITY_NEW_DESC
    planObj.iss = creds[2].did
    const planJwtEnc = await credentials[2].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('access same plan by second person, by external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + firstPlanIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access same plan by first person, by external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + firstPlanIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access same plan by first person, by full external ID, still getting initial plan', () => {
    return request(Server)
      .get('/api/plan/' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(testUtil.INITIAL_DESCRIPTION)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 update for external claim fails', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.lastClaimId = "https://another-ledger.com/claim/123"
    planObj.claim.description = ENTITY_NEW_DESC
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
        expect(r.body.error.message).that.contains("other system")
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 update plan description & location for plan #1', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.lastClaimId = firstPlanIdInternal
    planObj.claim.description = ENTITY_NEW_DESC
    planObj.claim.location.geo.latitude =
      testUtil.claimPlanAction.location.geo.latitude + 1
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: planJwtEnc})
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.status).that.equals(201)
      firstPlanClaim2IdInternal = r.body.success.claimId
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('access same exact plan by first person & internal plan claim ID, still getting initial plan but with new description', () => {
    return request(Server)
      .get('/api/plan/' + firstPlanIdInternal)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(ENTITY_NEW_DESC)
        expect(r.body.locLat).that.equals(testUtil.claimPlanAction.location.geo.latitude + 1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access same exact plan by first person & second internal ID, still getting initial plan but with new description', () => {
    return request(Server)
        .get('/api/plan/' + firstPlanClaim2IdInternal)
        .set('Authorization', 'Bearer ' + pushTokens[1])
        .then(r => {
          expect(r.headers['content-type'], /json/)
          expect(r.body.agentDid).that.equals(creds[1].did)
          expect(r.body.issuerDid).that.equals(creds[1].did)
          expect(r.body.handleId).that.equals(firstPlanIdExternal)
          expect(r.body.description).that.equals(ENTITY_NEW_DESC)
        }).catch((err) => {
          return Promise.reject(err)
        })
  }).timeout(3000)

  it('access same exact plan by first person & first handle ID, still getting initial plan but with new description', () => {
    return request(Server)
      .get('/api/plan/' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.agentDid).that.equals(creds[1].did)
        expect(r.body.issuerDid).that.equals(creds[1].did)
        expect(r.body.handleId).that.equals(firstPlanIdExternal)
        expect(r.body.description).that.equals(ENTITY_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('access raw updated plan claim by first user, by external ID', () => {
    return request(Server)
      .get('/api/claim/byHandle/' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.issuer).that.equals(creds[1].did)
        expect(r.body.claim.agent.identifier).that.equals(creds[1].did)
        expect(r.body.claim.name).that.equals(testUtil.claimPlanAction.name)
        expect(r.body.claim.description).that.equals(ENTITY_NEW_DESC)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 fail to update a plan with wrong type', async () => {
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimOffer)
    planObj.claim.offeredBy = { identifier: creds[1].did }
    planObj.claim.lastClaimId = firstPlanClaim2IdInternal
    planObj.claim.includesObject = { description: ENTITY_NEW_DESC }
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .then(r => {
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 insert of plan with external ID from different system', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planWithExtFullBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).that.equals('scheme://from-somewhere/with-some-plan-id')
        secondPlanIdExternal = r.body.success.handleId
        secondPlanIdInternal = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans again', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[1].handleId).to.equal(firstPlanIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 insert of second plan by second person', () => {
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planNewBy2JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans by first user', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 retrieve plans by first user starting with #2', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer?beforeId=2')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('v2 retrieve all plans by second user', () => {
    return request(Server)
      .get('/api/v2/report/plansByIssuer')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve some plan counts inside bounding box', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
      .get('/api/v2/report/planCountsByBBox'
        + '?minLocLat' + '=' + (lat - 0.1)
        + '&maxLocLat' + '=' + (lat + 1)
        + '&westLocLon' + '=' + (lon - 0.1)
        + '&eastLocLon' + '=' + (lon + 1)
      )
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.tiles.length).that.equals(3)
        const minGridLat = r.body.data.minGridLat
        const minGridLon = r.body.data.minGridLon
        const tileWidth = r.body.data.tileWidth

        // the single coordinate is from planWithoutIdBy1JwtObj
        expect(r.body.data.tiles[0].indexLat).that.equals(minGridLat)
        expect(r.body.data.tiles[0].indexLon).that.equals(minGridLon)
        expect(r.body.data.tiles[0].minFoundLat).that.equals(lat)
        expect(r.body.data.tiles[0].maxFoundLat).that.equals(lat)
        expect(r.body.data.tiles[0].minFoundLon).that.equals(lon)
        expect(r.body.data.tiles[0].maxFoundLon).that.equals(lon)
        expect(r.body.data.tiles[0].recordCount).that.equals(1)

        // the single coordinate is from planNewBy2JwtObj
        expect(r.body.data.tiles[1].indexLat).that.equals(minGridLat + 1 * tileWidth)
        expect(r.body.data.tiles[1].indexLon).that.equals(minGridLon + 1 * tileWidth)
        expect(r.body.data.tiles[1].minFoundLat).that.equals(lat + 0.1)
        expect(r.body.data.tiles[1].maxFoundLat).that.equals(lat + 0.1)
        expect(r.body.data.tiles[1].minFoundLon).that.equals(lon + 0.1)
        expect(r.body.data.tiles[1].maxFoundLon).that.equals(lon + 0.1)
        expect(r.body.data.tiles[1].recordCount).that.equals(1)

        // the single coordinate is from firstPlanIdSecondClaimInternal
        expect(r.body.data.tiles[2].indexLat).that.equals(minGridLat + 7 * tileWidth)
        expect(r.body.data.tiles[2].indexLon).that.equals(minGridLon)
        expect(r.body.data.tiles[2].minFoundLat).that.equals(lat + 1)
        expect(r.body.data.tiles[2].maxFoundLat).that.equals(lat + 1)
        expect(r.body.data.tiles[2].minFoundLon).that.equals(lon)
        expect(r.body.data.tiles[2].maxFoundLon).that.equals(lon)
        expect(r.body.data.tiles[2].recordCount).that.equals(1)
      }).catch((err) => {
        return Promise.reject(err)
      })
  })

  it('retrieve some plan counts inside a bigger bounding box', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
    .get('/api/v2/report/planCountsByBBox'
      + '?minLocLat' + '=' + (lat - 0.1)
      + '&maxLocLat' + '=' + (lat + 5)
      + '&westLocLon' + '=' + (lon - 0.1)
      + '&eastLocLon' + '=' + (lon + 5)
    )
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data.tiles.length).that.equals(2)
      const minGridLat = r.body.data.minGridLat
      const minGridLon = r.body.data.minGridLon
      const tileWidth = r.body.data.tileWidth

      // the min coordinates are from planWithoutIdBy1JwtObj
      // the max coordinates are from planNewBy2JwtObj
      expect(r.body.data.tiles[0].indexLat).that.equals(minGridLat)
      expect(r.body.data.tiles[0].indexLon).that.equals(minGridLon)
      expect(r.body.data.tiles[0].minFoundLat).that.equals(lat)
      expect(r.body.data.tiles[0].maxFoundLat).that.equals(lat + 0.1)
      expect(r.body.data.tiles[0].minFoundLon).that.equals(lon)
      expect(r.body.data.tiles[0].maxFoundLon).that.equals(lon + 0.1)
      expect(r.body.data.tiles[0].recordCount).that.equals(2)

      // the single coordinate is from firstPlanIdSecondClaimInternal
      expect(r.body.data.tiles[1].indexLat).that.equals(minGridLat + 1 * tileWidth)
      expect(r.body.data.tiles[1].indexLon).that.equals(minGridLon)
      expect(r.body.data.tiles[1].minFoundLat).that.equals(lat + 1)
      expect(r.body.data.tiles[1].maxFoundLat).that.equals(lat + 1)
      expect(r.body.data.tiles[1].minFoundLon).that.equals(lon)
      expect(r.body.data.tiles[1].maxFoundLon).that.equals(lon)
      expect(r.body.data.tiles[1].recordCount).that.equals(1)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('retrieve some plan counts inside an even bigger bounding box', () => {
    const lat = testUtil.claimPlanAction.location.geo.latitude
    const lon = testUtil.claimPlanAction.location.geo.longitude
    return request(Server)
    .get('/api/v2/report/planCountsByBBox'
      + '?minLocLat' + '=' + (lat - 0.1)
      + '&maxLocLat' + '=' + (lat + 10)
      + '&minLocLon' + '=' + (lon - 0.1)
      + '&maxLocLon' + '=' + (lon + 10)
    )
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data.tiles.length).that.equals(1)
      const minGridLat = r.body.data.minGridLat
      const minGridLon = r.body.data.minGridLon

      // the min coordinates are from planWithoutIdBy1JwtObj
      // the max coordinates are from firstPlanIdSecondClaimInternal
      expect(r.body.data.tiles[0].indexLat).that.equals(minGridLat)
      expect(r.body.data.tiles[0].indexLon).that.equals(minGridLon)
      expect(r.body.data.tiles[0].minFoundLat).that.equals(lat)
      expect(r.body.data.tiles[0].maxFoundLat).that.equals(lat + 1)
      expect(r.body.data.tiles[0].minFoundLon).that.equals(lon)
      expect(r.body.data.tiles[0].maxFoundLon).that.equals(lon + 0.1)
      expect(r.body.data.tiles[0].recordCount).that.equals(3)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('fail to make a plan with mismatched lastClaimId & identifier', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.identifier = secondPlanIdExternal
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanClaim2IdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('make a child plan that fulfills another one', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanClaim2IdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        planBy2FulfillsBy1Claim1IdExternal = r.body.success.handleId
        planBy2FulfillsBy1Claim1IdInternal = r.body.success.claimId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans and check that the child plan has a fulfills claim ID', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(4)
        expect(r.body.data[0].handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve no parent plan link from parent', () => {
    return request(Server)
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.equal(null)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve one parent plan link from child', () => {
    return request(Server)
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.childFulfillsLinkConfirmed).to.be.false
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve one child plan link from parent', () => {
    return request(Server)
      .get('/api/v2/report/planFulfillersToPlan?planHandleId=' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.false
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve no child plan link from child', () => {
    return request(Server)
      .get('/api/v2/report/planFulfillersToPlan?planHandleId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('issuer of parent plan confirms fulfills link', async () => {
    const confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
    const planClaim = R.clone(planBy2FulfillsBy1Claim)
    planClaim.fulfills.lastClaimId = firstPlanClaim2IdInternal // just to make it like the current record
    planClaim.lastClaimId = planBy2FulfillsBy1Claim1IdInternal
    confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj.claim.object.push(planClaim)
    confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj.sub = creds[2].did
    confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj.iss = creds[1].did
    const planJwt = await credentials[1].createVerification(confirmplanBy2FulfillsBy1Claim1For2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwt})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
              'Something went wrong, but nothing critical. Here is the error:',
              r.body.success.embeddedRecordError
          )
        }
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('parent plan link from child now shows that it is confirmed', () => {
    return request(Server)
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.childFulfillsLinkConfirmed).to.be.true
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve one child plan link from parent and show confirmed', () => {
    return request(Server)
      .get('/api/v2/report/planFulfillersToPlan?planHandleId=' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.true
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('fail to update child plan fulfills with mismatching claim ID & handle ID', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.identifier = secondPlanIdExternal
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanClaim2IdInternal
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = planBy2FulfillsBy1Claim1IdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('update child plan and update fulfills claim ID link', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanClaim2IdInternal
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = planBy2FulfillsBy1Claim1IdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        expect(r.body.success.handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        planBy2FulfillsBy1Claim2IdInternal = r.body.success.claimId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans and check that child plan has updated fulfills claim link', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(4)
        expect(r.body.data[0].handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
        expect(globalId(firstPlanClaim2IdInternal)).to.not.equal(firstPlanIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('update plan and remove fulfills link', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills = undefined
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = planBy2FulfillsBy1Claim2IdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        expect(r.body.success.handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        planBy2FulfillsBy1Claim3IdInternal = r.body.success.claimId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('v2 retrieve all plans and check that #2 has no fulfills info', () => {
    return request(Server)
      .get('/api/v2/report/plans')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(4)
        expect(r.body.data[0].handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(null)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('parent plan link from child no longer shows that it is confirmed', () => {
    return request(Server)
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.null
        expect(r.body.childFulfillsLinkConfirmed).to.not.be.true // because may be undefined or false
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve no child plan link from parent', () => {
    return request(Server)
      .get('/api/v2/report/planFulfillersToPlan?planHandleId=' + encodeURIComponent(firstPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  // Test the multiple plans endpoint
  it('GET multiple plans by handle IDs should return array of plans', () => {
    const planHandleIds = [firstPlanIdExternal, secondPlanIdExternal, planBy2FulfillsBy1Claim1IdExternal]
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: JSON.stringify(planHandleIds) })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.be.an('array')
        expect(r.body.length).to.equal(3)
        
        // Verify each plan is returned correctly
        const handleIds = r.body.map(plan => plan.handleId)
        expect(handleIds).to.include(firstPlanIdExternal)
        expect(handleIds).to.include(secondPlanIdExternal)
        expect(handleIds).to.include(planBy2FulfillsBy1Claim1IdExternal)
        
        // Verify structure of each plan
        r.body.forEach(plan => {
          expect(plan).to.have.property('handleId')
          expect(plan).to.have.property('jwtId')
          expect(plan).to.have.property('agentDid')
          expect(plan).to.have.property('issuerDid')
          expect(plan).to.have.property('description')
        })
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans with empty array should return empty array', () => {
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: JSON.stringify([]) })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.be.an('array')
        expect(r.body.length).to.equal(0)
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans with non-existent IDs should return empty array', () => {
    const nonExistentIds = ['non-existent-1', 'non-existent-2']
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: JSON.stringify(nonExistentIds) })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.be.an('array')
        expect(r.body.length).to.equal(0)
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans with mixed existing and non-existent IDs should return only existing plans', () => {
    const mixedIds = [firstPlanIdExternal, 'non-existent-id', secondPlanIdExternal]
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: JSON.stringify(mixedIds) })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.be.an('array')
        expect(r.body.length).to.equal(2)
        
        const handleIds = r.body.map(plan => plan.handleId)
        expect(handleIds).to.include(firstPlanIdExternal)
        expect(handleIds).to.include(secondPlanIdExternal)
        expect(handleIds).to.not.include('non-existent-id')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans without planHandleIds parameter should return 400', () => {
    return request(Server)
      .get('/api/plan')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.equal('planHandleIds query parameter is required')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans with invalid JSON should return 400', () => {
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: 'invalid-json' })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.equal('Invalid JSON in planHandleIds parameter')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET multiple plans with non-array planHandleIds should return 400', () => {
    return request(Server)
      .get('/api/plan')
      .query({ planHandleIds: JSON.stringify('not-an-array') })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.equal('planHandleIds must be a JSON array')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

})
















let timeToWait = 0
if (process.env.INFURA_PROJECT_ID) {
  timeToWait = 3000; // wait for the infura.io verification
}

describe('6 - PlanAction just for BVC, partly for testing data on a local server', () => {

  let bvcPlanLastClaimId

  it('insert BVC plan', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.name = "Bountiful Voluntaryist Community Activities"
    planObj.claim.description = "We do random stuff together."
    planObj.claim.startTime = "2017-11-25"
    planObj.claim.endTime = undefined
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        bvcPlanLastClaimId = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('find plan in search', () => {
    return request(Server)
      .get('/api/v2/report/plans?claimContents=Bountiful%20together')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  const NUM_GIVES = 51
  it('add many gives', async () => {
    const claimGive_OthersBy1_JwtObj = R.clone(testUtil.jwtTemplate)
    claimGive_OthersBy1_JwtObj.claim = R.clone(testUtil.claimGive)
    claimGive_OthersBy1_JwtObj.claim.fulfills = [
      { '@type': 'PlanAction', lastClaimId: bvcPlanLastClaimId },
      { '@type': 'DonateAction' },
    ]
    claimGive_OthersBy1_JwtObj.claim.object = {
      '@type': 'TypeAndQuantityNode',
      amountOfThisGood: 1,
      unitCode: 'HUR',
    }
    claimGive_OthersBy1_JwtObj.sub = creds[1].did

    const manyGives =
      R.times(n =>
        R.clone(claimGive_OthersBy1_JwtObj),
        NUM_GIVES
      )
      .map((vc, i) => {
        // count back i seconds ago to ensure none have exact same time and get rejected
        const newTime = new Date().getTime() - (i * 1000)
        vc.claim.issuedAt = new Date(newTime).toISOString()
        return vc
      })

    const givesProms = manyGives.map(async (vc, i) => {
      return new Promise((resolve, reject) => {
        credentials[1].createVerification(vc)
          .then(vcJwt => {
            return request(Server)
            .post('/api/v2/claim')
            .send({jwtEncoded: vcJwt})
            .expect('Content-Type', /json/)
            .then(r => {
              expect(r.status).that.equals(201)
              expect(r.body.success).does.not.have.property('embeddedRecordError')
              //console.log('Inserted give #', i + 1, 'of', manyGives.length)
              resolve()
            }).catch((err) => {
              reject(err)
            })

          })
      })
    })
    return await Promise.all(givesProms)
  }).timeout(timeToWait * NUM_GIVES)

})

describe('6 - add many PlanActions, partly for scrolling UI tests', () => {
  const NUM_PLANS = 21
  it('add many plans', async () => {
    const claimPlan_OthersBy1_JwtObj = R.clone(testUtil.jwtTemplate)
    claimPlan_OthersBy1_JwtObj.claim = R.clone(testUtil.claimPlanAction)
    claimPlan_OthersBy1_JwtObj.claim.description = "Some Great Plan"

    const manyPlans =
      R.times(() => R.clone(claimPlan_OthersBy1_JwtObj), NUM_PLANS)
      .map((vc, i) => {
        vc.claim.description += " #" + (i + 1)
        vc.claim.name += " #" + (i + 1)
        return vc
      })

    const plansProms = manyPlans.map(async (vc, i) => {
      return new Promise((resolve, reject) => {
        credentials[1].createVerification(vc)
        .then(vcJwt => {
          return request(Server)
          .post('/api/v2/claim')
          .send({jwtEncoded: vcJwt})
          .expect('Content-Type', /json/)
          .then(r => {
            expect(r.status).that.equals(201)
            expect(r.body.success).does.not.have.property('embeddedRecordError')
            //console.log('Inserted plan #', i + 1, 'of', manyPlans.length)
            resolve()
          }).catch((err) => {
            reject(err)
          })

        })
      })
    })
    return await Promise.all(plansProms)
  }).timeout(timeToWait * NUM_PLANS)
})





let firstOfferId, anotherProjectOfferId, offerHandleId6, validThroughDate

describe('6 - Check offer totals', () => {

  it('plan owner has no offers', async () => {
    return request(Server)
    .get('/api/v2/report/offersToPlansOwnedByMe')
    .set('Authorization', 'Bearer ' + pushTokens[1])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(0)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('other person has no plans with offers', async () => {
    return request(Server)
    .get('/api/v2/report/offersToPlansOwnedByMe')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(0)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('insert offer #1 that is for a project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.fulfills = {
      '@type': 'PlanAction',
      lastClaimId: firstPlanClaim2IdInternal,
    }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR',
      description: 'Groom the horses'
    }
    credObj.claim.offeredBy = { identifier: creds[2].did }
    validThroughDate = new Date()
    credObj.claim.validThrough = validThroughDate.toISOString()
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        firstOfferId = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(10000)

  it('offer data is correct', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(firstOfferId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].offeredByDid).to.equal(creds[2].did)
        expect(r.body.data[0].recipientDid).to.be.null
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(1)
        expect(r.body.data[0].amountGiven).to.equal(0)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(0)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(0)
        // the sqlite DB truncates date milliseconds
        const dbDate = new Date(r.body.data[0].validThrough)
        const valDate = validThroughDate
        valDate.setMilliseconds(0)
        expect(dbDate.getTime()).to.equal(valDate.getTime())
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer total fails without certain parameters', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?unit=HUR')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer total fails with recipient that does not match issuer', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?recipientId=' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer totals are correct', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?planId=' + firstPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": 1})
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('find offer in search', () => {
    return request(Server)
      .get('/api/v2/report/offers?claimContents=groom%20horse')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].fulfillsPlanHandleId).that.equals(firstPlanIdExternal)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('plan owner now has an offer', async () => {
    return request(Server)
    .get('/api/v2/report/offersToPlansOwnedByMe')
    .set('Authorization', 'Bearer ' + pushTokens[1])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(1)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('other person still has no plans with offers', async () => {
    return request(Server)
    .get('/api/v2/report/offersToPlansOwnedByMe')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(0)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('insert offer #2 that is for the same project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.fulfills = {
      '@type': 'PlanAction', lastClaimId: firstPlanClaim2IdInternal
    }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR',
      description: 'Take dogs for a walk'
    }
    credObj.claim.offeredBy = { identifier: creds[2].did }
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('insert offer #3 that is for the same project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.fulfills = {
      '@type': 'PlanAction', lastClaimId: firstPlanClaim2IdInternal
    }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR',
      description: 'Feed cats'
    }
    credObj.claim.offeredBy = { identifier: creds[3].did }
    credObj.sub = creds[3].did
    credObj.iss = creds[3].did
    const claimJwtEnc = await credentials[3].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer totals are correct after offer #3', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?planId=' + firstPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": 4 })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offers are correct for one project on multi-project endpoint', () => {
    return request(Server)
      .get(
        '/api/v2/report/offersToPlans?planIds='
          + encodeURIComponent(JSON.stringify([firstPlanIdExternal]))
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #4 for different project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.fulfills = {
      '@type': 'PlanAction', lastClaimId: secondPlanIdInternal
    }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR',
      description: 'Fleece sheep'
    }
    credObj.claim.offeredBy = { identifier: creds[4].did }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        anotherProjectOfferId = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offers are still correct for one project on multi-project endpoint', () => {
    return request(Server)
      .get(
        '/api/v2/report/offersToPlans?planIds='
          + encodeURIComponent(JSON.stringify([firstPlanIdExternal]))
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offers are correct for multiple projects', () => {
    return request(Server)
      .get(
        '/api/v2/report/offersToPlans?planIds='
          + encodeURIComponent(JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]))
      )
      .set('Authorization', 'Bearer ' + pushTokens[5])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(4)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #5 of different currency', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.fulfills = {
      '@type': 'PlanAction', lastClaimId: secondPlanIdInternal
    }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 20, unitCode: 'USD',
      description: 'Help with church performance night'
    }
    credObj.claim.offeredBy = { identifier: creds[4].did }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer totals are correct after offer #5', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?planId=' + secondPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": 2, "USD": 20 })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #6 directly to someone', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.offeredBy = { identifier: creds[4].did }
    credObj.claim.recipient = { identifier: creds[2].did }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR',
      description: 'First grade materials'
    }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        offerHandleId6 = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer data for #6 is correct', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].handleId).to.equal(offerHandleId6)
        expect(r.body.data[0].offeredByDid).to.equal(creds[4].did)
        expect(r.body.data[0].recipientDid).to.equal(creds[2].did)
        expect(r.body.data[0].fulfillsPlanHandleId).to.be.null
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountGiven).to.equal(0)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(0)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer fulfiller retrieval gets none', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToOffer?giveHandleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert offer #7 directly to someone for non-amount', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.offeredBy = { identifier: creds[5].did }
    credObj.claim.recipient = { identifier: creds[2].did }
    credObj.claim.includesObject = {
      description: 'First grade reading help',
    }
    credObj.sub = creds[5].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer total succeeds with recipient that matches issuer', () => {
    return request(Server)
      .get('/api/v2/report/offerTotals?recipientId=' + creds[2].did)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": 3 })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('plan owner #1 now has 3 offers', async () => {
    return request(Server)
    .get('/api/v2/report/offersToPlansOwnedByMe')
    .set('Authorization', 'Bearer ' + pushTokens[1])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(5)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

})




describe('6 - Check give totals', () => {

  let firstGiveRecordHandleId, secondGiveRecordHandleId, thirdGiveRecordHandleId

  it('insert give #1', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.fulfills.lastClaimId = localFromGlobalEndorserIdentifier(firstOfferId)
    credObj.claim.object = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR'
    }
    credObj.claim.description = 'Had so much fun that we danced'
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.body.success.fulfillsHandleId).to.equal(firstOfferId)
        expect(globalId(r.body.success.fulfillsLastClaimId)).to.equal(firstOfferId)
        expect(r.body.success.fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
        expect(r.body.success.fulfillsPlanLastClaimId).to.equal(firstPlanClaim2IdInternal)
        expect(r.body.success.fulfillsLinkConfirmed).to.be.true
        expect(r.body.success.giftNotTrade).to.be.null
        firstGiveRecordHandleId = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer data has some new amounts from the Give', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(firstOfferId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(1)
        expect(r.body.data[0].amountGiven).to.equal(2)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(0)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give total fails without certain parameters', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?unit=HUR')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.status).that.equals(400)
        expect(r.headers['content-type'], /json/)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give total fails with recipient that does not match issuer', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?recipientId=' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give totals are correct', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?planId=' + firstPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": { amount: 2, amountConfirmed: 0 } })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer embedded amounts have new totals', () => {
    return request(Server)
      .get(
        '/api/v2/report/offers?handleId=' + encodeURIComponent(firstOfferId)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.amount).to.equal()
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give fulfiller retrieval gets none', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToGive?giveHandleId=' + encodeURIComponent(firstGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert give #2', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    delete credObj.claim.description
    credObj.claim.fulfills = [
        { '@type': 'GiveAction', identifier: firstGiveRecordHandleId },
        { '@type': 'DonateAction' },
    ]
    credObj.claim.object = [
      { '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR' },
      { '@type': 'CreativeWork', description: 'Found new homeschooling friends' },
    ]
    credObj.claim.provider = {
      "@type": "GiveAction", "identifier": firstGiveRecordHandleId
    }
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.embeddedRecordWarning).to.not.be.null
        expect(r.body.success.handleId).to.be.a('string')
        secondGiveRecordHandleId = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give #2 has expected data', () => {
    return request(Server)
      .get('/api/v2/report/gives?handleId=' + encodeURIComponent(secondGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].agentDid).to.equal(null)
        expect(r.body.data[0].issuedAt).to.be.not.null
        expect(r.body.data[0].amount).to.equal(1)
        expect(r.body.data[0].amountConfirmed).to.equal(0)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].description).to.equal('Found new homeschooling friends')
        expect(r.body.data[0].fulfillsHandleId).to.equal(firstGiveRecordHandleId)
        expect(r.body.data[0].fulfillsLastClaimId).to.be.undefined
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.true
        expect(r.body.data[0].fulfillsType).to.equal('GiveAction')
        expect(r.body.data[0].fulfillsPlanHandleId).to.be.null
        expect(r.body.data[0].giftNotTrade).to.be.true
        expect(r.body.data[0].recipientDid).to.equal(null)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider retrieval gets one', () => {
    return request(Server)
      .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(secondGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].identifier).to.equal(firstGiveRecordHandleId)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give fulfiller retrieval gets one', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToGive?giveHandleId=' + encodeURIComponent(firstGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].description).to.equal('Found new homeschooling friends')
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.true
        expect(r.body.data[0].amount).to.equal(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].fullClaim.object[0].amountOfThisGood).to.equal(1)
        expect(r.body.data[0].fullClaim.object[0].unitCode).to.equal('HUR')
        expect(r.body.data[0].handleId).to.equal(secondGiveRecordHandleId)
        expect(r.body.data[0].issuedAt).to.be.not.null
        expect(r.body.data[0].agentDid).to.equal(null)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider retrieval by wrong one gets none', () => {
    return request(Server)
      .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(firstGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider-gives retrieval gets one', () => {
    return request(Server)
      .get('/api/v2/report/givesProvidedBy?providerId=' + encodeURIComponent(firstGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].description).to.equal('Found new homeschooling friends')
        expect(r.body.data[0].handleId).to.equal(secondGiveRecordHandleId)
        expect(r.body.data[0].issuedAt).to.be.not.null
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider-gives retrieval by wrong one gets none', () => {
    return request(Server)
        .get('/api/v2/report/givesProvidedBy?providerId=' + encodeURIComponent(creds[0].did))
        .set('Authorization', 'Bearer ' + pushTokens[2])
        .then(r => {
          expect(r.headers['content-type'], /json/)
          expect(r.body.data).to.be.an('array').of.length(0)
          expect(r.status).that.equals(200)
        }).catch((err) => {
          return Promise.reject(err)
        })
  }).timeout(3000)

  it('insert give #3', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.recipient = { identifier: creds[5].did }
    credObj.claim.fulfills = [
      { lastClaimId: localFromGlobalEndorserIdentifier(anotherProjectOfferId) },
      { '@type': 'DonateAction' },
    ]
    credObj.claim.object = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR'
    }
    credObj.claim.description = 'Found more homeschooling friends who jam'
    credObj.claim.provider = [
      { "@type": "GiveAction", "identifier": firstGiveRecordHandleId },
      { "@type": "GiveAction", "identifier": secondGiveRecordHandleId },
    ]
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        thirdGiveRecordHandleId = r.body.success.handleId
        expect(r.body.success.fulfillsLinkConfirmed).to.be.false
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give totals are correct for second plan', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?planId=' + secondPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": { amount: 3, amountConfirmed: 0 } })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('gives are correct for multiple projects', () => {
    return request(Server)
      .get(
        '/api/v2/report/givesToPlans?planIds='
          + encodeURIComponent(JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]))
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].amountConfirmed).to.be.equal(0)
        // these test that a user can see all data from their own claims
        expect(r.body.data[0].recipientDid).to.be.equal(creds[5].did)
        expect(r.body.data[0].fullClaim.recipient.identifier).to.be.equal(creds[5].did)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider retrieval works for multiple providers', () => {
    return request(Server)
      .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(thirdGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].identifier).to.equal(firstGiveRecordHandleId)
        expect(r.body.data[1].identifier).to.equal(secondGiveRecordHandleId)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('modify give #3', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.lastClaimId = localFromGlobalEndorserIdentifier(thirdGiveRecordHandleId)
    credObj.claim.fulfills = [
      { lastClaimId: localFromGlobalEndorserIdentifier(anotherProjectOfferId) },
      { '@type': 'DonateAction' },
    ]
    credObj.claim.object = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR'
    }
    credObj.claim.description = 'Found more homeschooling friends who jam'
    credObj.claim.provider = [
      { "@type": "GiveAction", "identifier": firstGiveRecordHandleId },
    ]
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
              'Something went wrong, but nothing critical. Here is the error:',
              r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.body.success.handleId).to.equal(thirdGiveRecordHandleId)
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('provider retrieval works for one updated', () => {
    return request(Server)
      .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(thirdGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].identifier).to.equal(firstGiveRecordHandleId)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider-gives retrieval gets two', () => {
    return request(Server)
      .get('/api/v2/report/givesProvidedBy?providerId=' + encodeURIComponent(firstGiveRecordHandleId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].handleId).to.equal(thirdGiveRecordHandleId)
        expect(r.body.data[0].description).to.equal('Found more homeschooling friends who jam')
        expect(r.body.data[0].fullClaim.description).to.equal('Found more homeschooling friends who jam')
        expect(r.body.data[0].issuedAt).to.be.not.null
        expect(r.body.data[1].handleId).to.equal(secondGiveRecordHandleId)
        expect(r.body.data[1].description).to.equal('Found new homeschooling friends')
        expect(r.body.data[1].fullClaim.description).to.be.undefined
        expect(r.body.data[1].fullClaim.object[1].description).to.equal('Found new homeschooling friends')
        expect(r.body.data[1].issuedAt).to.be.not.null
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('wrong user confirms a give (though it will not be counted later)', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    const credClaimObj = {
      '@type': 'GiveAction',
      lastClaimId: localFromGlobalEndorserIdentifier(firstGiveRecordHandleId)
    }
    credObj.claim.object.push(credClaimObj)
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give confirmation did not work (wrong issuer)', () => {
    return request(Server)
      .get(
        '/api/v2/report/gives?handleId='
          + encodeURIComponent(firstGiveRecordHandleId)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].amountConfirmed).to.be.equal(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('confirm give #2 by the original recipient', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    const credClaimObj = {
      '@type': 'GiveAction',
      lastClaimId: localFromGlobalEndorserIdentifier(firstGiveRecordHandleId)
    }
    credObj.claim.object.push(credClaimObj)
    credObj.sub = creds[1].did
    credObj.iss = creds[1].did
    const claimJwtEnc = await credentials[1].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give confirmation set an amount confirmed', () => {
    return request(Server)
      .get(
        '/api/v2/report/gives?handleId='
          + encodeURIComponent(firstGiveRecordHandleId)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].amountConfirmed).to.be.greaterThan(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer data now also has a confirmed amount', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(firstOfferId))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(1)
        expect(r.body.data[0].amountGiven).to.equal(2)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(2)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert give #4 by recipient, recognizing it from someone else', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.agent = { identifier: creds[4].did }
    credObj.claim.recipient = { identifier: creds[2].did }
    credObj.claim.fulfills.lastClaimId = localFromGlobalEndorserIdentifier(offerHandleId6)
    credObj.claim.description = 'Giving it up for those first graders'
    credObj.claim.object.amountOfThisGood = 4
    credObj.sub = creds[2].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer #6 data now has a confirmed amount', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountGiven).to.equal(4)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(4)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give total works with recipient that matches issuer', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?recipientId=' + creds[2].did)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": { amount: 4, amountConfirmed: 4 } })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert give #5 by recipient that has no specific amounts', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.agent = { identifier: creds[4].did }
    credObj.claim.recipient = { identifier: creds[2].did }
    credObj.claim.fulfills.lastClaimId = localFromGlobalEndorserIdentifier(offerHandleId6)
    credObj.claim.description = 'Thanks for the first-grade learning materials!'
    delete credObj.claim.object
    credObj.sub = creds[4].did
    credObj.iss = creds[2].did
    const claimJwtEnc = await credentials[2].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer #6 data now has a confirmed non-amount', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountGiven).to.equal(4)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(4)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(1)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  let giveRecordHandleId6, giveRecordLastClaimId6

  it('insert give #6 by recipient who owns original plan', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.recipient = { identifier: creds[1].did }
    credObj.claim.fulfills.lastClaimId = localFromGlobalEndorserIdentifier(offerHandleId6)
    credObj.claim.description = 'First-graders & snowboarding & horses?'
    credObj.claim.provider = [
      { "@type": "GiveAction", "identifier": secondGiveRecordHandleId },
      { "@type": "GiveAction", "identifier": thirdGiveRecordHandleId },
    ]
    delete credObj.claim.object
    credObj.sub = creds[2].did
    credObj.iss = creds[1].did
    const claimJwtEnc = await credentials[1].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        giveRecordHandleId6 = r.body.success.handleId
        giveRecordLastClaimId6 = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('offer #6 data now has even more paid & confirmed', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountGiven).to.equal(4)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(4)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(2)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give #6 is confirmed because it is from the project creator', () => {
    return request(Server)
      .get(
        '/api/v2/report/gives?handleId='
          + encodeURIComponent(giveRecordHandleId6)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].amountConfirmed).to.be.greaterThan(0)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer fulfiller retrieval gets three', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToOffer?offerHandleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.body.data[0].fullClaim.description).to.equal('First-graders & snowboarding & horses?')
        expect(r.body.data[1].fullClaim.description).to.equal('Thanks for the first-grade learning materials!')
        expect(r.body.data[2].fullClaim.description).to.equal('Giving it up for those first graders')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('provider retrieval works for a provider that was updated', () => {
    return request(Server)
      .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(giveRecordHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].identifier).to.equal(secondGiveRecordHandleId)
        expect(r.body.data[1].identifier).to.equal(thirdGiveRecordHandleId)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('update give #6 by owner to remove fulfills link', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.lastClaimId = giveRecordLastClaimId6
    credObj.claim.recipient = { identifier: creds[1].did }
    // skipping fulfills
    credObj.claim.description = 'First-graders & snowboarding & horses?'
    credObj.claim.provider = [
      { "@type": "GiveAction", "identifier": secondGiveRecordHandleId },
      { "@type": "GiveAction", "identifier": thirdGiveRecordHandleId },
    ]
    delete credObj.claim.object
    credObj.sub = creds[2].did
    credObj.iss = creds[1].did
    const claimJwtEnc = await credentials[1].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.equal(giveRecordHandleId6)
        giveRecordLastClaimId6 = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give #6 now has amount 0', () => {
    return request(Server)
    .get(
      '/api/v2/report/gives?handleId='
      + encodeURIComponent(giveRecordHandleId6)
    )
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body).to.be.an('object')
      expect(r.body.data).to.be.an('array').of.length(1)
      expect(r.body.data[0].amount).to.equal(null)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('fulfilled offer link from child gives no longer shows after link is removed', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToOffer?offerHandleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].fullClaim.description).to.equal('Thanks for the first-grade learning materials!')
        expect(r.body.data[1].fullClaim.description).to.equal('Giving it up for those first graders')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  let giveRecordHandleId7

  it('insert give #7 to record a trade', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.agent = { identifier: creds[2].did }
    credObj.claim.recipient = { identifier: creds[1].did }
    delete credObj.claim.fulfills.identifier
    credObj.claim.fulfills = [
      { lastClaimId: planBy2FulfillsBy1Claim2IdInternal },
      { "@type": "TradeAction" },
    ]
    credObj.claim.description = 'Trading the ginger chews'
    credObj.claim.object.amountOfThisGood = 3
    credObj.claim.object.unitCode = 'USD'
    credObj.sub = creds[2].did
    credObj.iss = creds[1].did
    const claimJwtEnc = await credentials[1].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.error('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.error(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        giveRecordHandleId7 = r.body.success.handleId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('give totals after #7 are correct with a default request', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?planId=' + firstPlanIdExternal)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": { amount: 2, amountConfirmed: 2 } })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give totals after #7 are correct for child plan with defaults', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": { amount: 3, amountConfirmed: 3 } })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #7 are correct for child plan with only gifted', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal) + '&onlyGifted=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({})
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #7 are correct for child plan with only traded', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal) + '&onlyTraded=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": { amount: 3, amountConfirmed: 3 } })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give #7 has correct settings', () => {
    return request(Server)
      .get(
        '/api/v2/report/gives?handleId='
        + encodeURIComponent(giveRecordHandleId7)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data[0].giftNotTrade).to.be.false
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('insert give #8 to record a donation to the same plan as #7', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.agent = { identifier: creds[3].did }
    delete credObj.claim.fulfills.identifier
    credObj.claim.fulfills = [
      { lastClaimId: planBy2FulfillsBy1Claim2IdInternal },
      { "@type": "DonateAction" },
    ]
    credObj.claim.description = 'Donating the licorice'
    credObj.claim.object.amountOfThisGood = 2
    credObj.claim.object.unitCode = 'USD'
    credObj.sub = creds[3].did
    credObj.iss = creds[3].did
    const claimJwtEnc = await credentials[3].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.error(
          'Something went wrong, but nothing critical. Here is the error:',
          r.body.success.embeddedRecordError
        )
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.success.handleId).to.be.a('string')
      expect(r.status).that.equals(201)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('insert give #9 to record a donation to the same plan as #7', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.agent = { identifier: creds[4].did }
    delete credObj.claim.fulfills.identifier
    credObj.claim.fulfills = [
      { lastClaimId: planBy2FulfillsBy1Claim2IdInternal },
      { "@type": "DonateAction" },
    ]
    credObj.claim.description = 'Donating the licorice'
    credObj.claim.object.amountOfThisGood = 1
    credObj.claim.object.unitCode = 'HUR'
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.error(
          'Something went wrong, but nothing critical. Here is the error:',
          r.body.success.embeddedRecordError
        )
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.success.handleId).to.be.a('string')
      expect(r.status).that.equals(201)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('give totals after #8 are correct for child plan with defaults', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal))
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "HUR": { amount: 1, amountConfirmed: 0 }, "USD": { amount: 5, amountConfirmed: 3 } })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #8 are correct for child plan with only gifted', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal) + '&onlyGifted=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "HUR": { amount: 1, amountConfirmed: 0 }, "USD": { amount: 2, amountConfirmed: 0 } })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #8 are correct for child plan with only traded', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(planBy2FulfillsBy1Claim1IdExternal) + '&onlyTraded=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": { amount: 3, amountConfirmed: 3 } })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  let lastGiveClaimId
  it('all give search does include first 50', () => {
    return request(Server)
    .get('/api/v2/report/gives')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data.length).to.equal(50)
      expect(r.status).that.equals(200)
      lastGiveClaimId = r.body.data[49].jwtId
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('all give search does include remaining 11', () => {
    return request(Server)
      .get('/api/v2/report/gives?beforeId=' + lastGiveClaimId)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.length).to.equal(11)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  let lastDonateGiveClaimId
  it('gift-only search does include first 50', () => {
    return request(Server)
      .get('/api/v2/report/gives?giftNotTrade=true')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.length).to.equal(50)
        expect(r.status).that.equals(200)
        lastDonateGiveClaimId = r.body.data[49].jwtId
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('gift-only search does not include trade', () => {
    return request(Server)
      .get('/api/v2/report/gives?giftNotTrade=true&beforeId=' + lastDonateGiveClaimId)
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.length).to.equal(5) // 5 are blank
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('trade search does include trade', () => {
    return request(Server)
      .get('/api/v2/report/gives?giftNotTrade=false')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data.length).to.equal(1)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  /**
   * This fails... but it's not an important use case and may not be worth recovering.
   *
  it('give totals after #7 are correct when including trades - fails', () => {
    return request(Server)
      .get('/api/v2/report/giveTotals?planId=' + firstPlanIdExternal + '&includeTrades=true')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": { amount: 2, amountConfirmed: 0 }, "USD": { amount: 3, amountConfirmed: 0 } })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)
  **/

  it('update give #6 to adjust description & totals and also to be a donation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.lastClaimId = giveRecordLastClaimId6
    credObj.claim.recipient = { identifier: creds[1].did }
    credObj.claim.fulfills = [
      { lastClaimId: localFromGlobalEndorserIdentifier(offerHandleId6) },
      { "@type": "DonateAction" },
    ]
    credObj.claim.description = 'First-graders & snowboarding ... that is enough'
    credObj.claim.provider = [
      { "@type": "GiveAction", "identifier": secondGiveRecordHandleId },
      { "@type": "GiveAction", "identifier": thirdGiveRecordHandleId },
    ]
    credObj.claim.object.amountOfThisGood = 3
    credObj.sub = creds[2].did
    credObj.iss = creds[1].did
    const claimJwtEnc = await credentials[1].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.error(
          'Something went wrong, but nothing critical. Here is the error:',
          r.body.success.embeddedRecordError
        )
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.success.handleId).to.equal(giveRecordHandleId6)
      expect(r.body.success.description).to.equal('First-graders & snowboarding ... that is enough')
      giveRecordLastClaimId6 = r.body.success.claimId
      expect(r.status).that.equals(201)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('give #6 is has changed description & amount', () => {
    return request(Server)
      .get(
        '/api/v2/report/gives?handleId='
        + encodeURIComponent(giveRecordHandleId6)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body).to.be.an('object')
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].description).to.equal('First-graders & snowboarding ... that is enough')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountConfirmed).to.equal(1)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('offer #6 data now has even more paid & confirmed', () => {
    return request(Server)
      .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0].unit).to.equal('HUR')
        expect(r.body.data[0].amount).to.equal(3)
        expect(r.body.data[0].amountGiven).to.equal(7)
        expect(r.body.data[0].amountGivenConfirmed).to.equal(7)
        expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(2)
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('update of offer #6 by someone else fails', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.lastClaimId = offerHandleId6
    credObj.claim.offeredBy = { identifier: creds[4].did }
    credObj.claim.recipient = { identifier: creds[3].did }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR',
      description: 'First grade materials to user 3'
    }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[3].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      expect(r.status).that.equals(400)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('update of offer #6 succeeds', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.lastClaimId = localFromGlobalEndorserIdentifier(offerHandleId6)
    credObj.claim.offeredBy = { identifier: creds[4].did }
    credObj.claim.recipient = { identifier: creds[5].did }
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 60, unitCode: 'USD',
      description: 'First grade materials to user 5'
    }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.headers['content-type'], /json/)
      expect(r.body.success.handleId).to.equal(offerHandleId6)
      expect(r.status).that.equals(201)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('offer #6 data has new & old data', () => {
    return request(Server)
    .get('/api/v2/report/offers?handleId=' + encodeURIComponent(offerHandleId6))
    .set('Authorization', 'Bearer ' + pushTokens[4])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('array').of.length(1)
      expect(r.body.data[0].fullClaim.includesObject.description).to.equal('First grade materials to user 5')
      expect(r.body.data[0].unit).to.equal('USD')
      expect(r.body.data[0].amount).to.equal(60)
      expect(r.body.data[0].amountGiven).to.equal(7)
      expect(r.body.data[0].amountGivenConfirmed).to.equal(7)
      expect(r.body.data[0].nonAmountGivenConfirmed).to.equal(2)
      expect(r.body.data[0].recipientDid).to.equal(creds[5].did)
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('offer fulfiller retrieval gets three', () => {
    return request(Server)
      .get('/api/v2/report/giveFulfillersToOffer?offerHandleId=' + encodeURIComponent(offerHandleId6))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(3)
        expect(r.body.data[0].fullClaim.description).to.equal('First-graders & snowboarding ... that is enough')
        expect(r.body.data[1].fullClaim.description).to.equal('Thanks for the first-grade learning materials!')
        expect(r.body.data[2].fullClaim.description).to.equal('Giving it up for those first graders')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})





describe('6 - Check plans as providers to gives', () => {
  let newGiveHandleId

  it('can add a plan as a provider to a give', async () => {
    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.description = "Colorful first-grade learning materials"
    credObj.claim.provider = {
      "@type": "PlanAction",  lastClaimId: firstPlanClaim2IdInternal
    }
    credObj.claim.recipient = { identifier: creds[5].did }
    const claimJwtEnc = await credentials[4].createVerification(credObj)
    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.body.success.handleId).to.be.a('string')
      newGiveHandleId = r.body.success.handleId
      expect(r.status).that.equals(201)
      expect(r.headers['content-type'], /json/)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('gets the correct providers for a give', async () => {
    return request(Server)
    .get('/api/v2/report/providersToGive?giveHandleId=' + encodeURIComponent(newGiveHandleId))
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.body.data).to.deep.equal([{ identifier: firstPlanIdExternal, linkConfirmed: false }])
      expect(r.status).that.equals(200)
      expect(r.headers['content-type'], /json/)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })

  it('gets the correct give for a provider', async () => {
    return request(Server)
    .get('/api/v2/report/givesProvidedBy?handleId=' + encodeURIComponent(firstPlanIdExternal))
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .then(r => {
      if (r.body.error) {
        console.error('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      }
      expect(r.body.data[0].agentDid).to.equal(null)
      expect(r.body.data[0].handleId).to.equal(newGiveHandleId)
      expect(r.body.data[0].providerId).to.equals(firstPlanIdExternal)
      expect(r.body.data[0].recipientDid).to.equal(creds[5].did)
      expect(r.status).that.equals(200)
      expect(r.headers['content-type'], /json/)
    }).catch((err) => {
      return Promise.reject(err)
    })
  })
})




describe('6 - claimId & handleId guards', () => {

  // I put this here anticipating that I'd run checks on the claim service with DB data from above.
  // I didn't get to it, but I'm leaving this here in case I do later.

  it('yields the correct values when searching for claimId & handleId', () => {
    expect(findAllLastClaimIdsAndHandleIds({})).to.deep.equal([])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3}]})).to.deep.equal([])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3}], lastClaimId:"x"}))
        .to.deep.equal([{lastClaimId:"x", clause:{a:1, b:[{c:3}], lastClaimId:"x"}}])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3}], lastClaimId:"x", handleId: "y"}))
        .to.deep.equal([{lastClaimId:"x", clause:{a:1, b:[{c:3}], lastClaimId:"x", handleId: "y"}}])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3, handleId: "z"}], lastClaimId: "x", handleId: "y"}))
        .to.deep.equal([
            {lastClaimId:"x", clause:{a:1, b:[{c:3, handleId: "z"}], lastClaimId: "x", handleId: "y"}},
            {handleId: "z", clause:{c:3, handleId: "z"}},
        ])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3, lastClaimId: "z"}], lastClaimId: "x", handleId: "y"}))
        .to.deep.equal([
            {lastClaimId:"x", clause:{a:1, b:[{c:3, lastClaimId: "z"}], lastClaimId: "x", handleId: "y"}},
            {lastClaimId:"z", clause:{c:3, lastClaimId: "z"}},
        ])
    expect(findAllLastClaimIdsAndHandleIds({a:1, b:[{c:3, lastClaimId:"z", handleId: "w"}], lastClaimId: "x", handleId: "y"}))
        .to.deep.equal([
            {lastClaimId:"x", clause:{a:1, b:[{c:3, lastClaimId:"z", handleId: "w"}], lastClaimId: "x", handleId: "y"}},
            {lastClaimId:"z", clause:{c:3, lastClaimId:"z", handleId: "w"}},
        ])
  })

})

describe('6 - Plans Last Updated Between', () => {
  
  let testPlanIdExternal, testPlanIdInternal, testPlanSecondClaimId
  let firstPlanClaim3IdInternal

  it('GET plansLastUpdatedBetween returns 400 for missing planIds', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .then(r => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.include('array parameter is required')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('POST plansLastUpdatedBetween returns 400 for missing planIds', () => {
    return request(Server)
      .post('/api/v2/report/plansLastUpdatedBetween')
      .send({})
      .then(r => {
        expect(r.status).to.equal(400)
        expect(r.body.error).to.include('array parameter is required')
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('POST plansLastUpdatedBetween returns empty array for empty planIds array', () => {
    return request(Server)
      .post('/api/v2/report/plansLastUpdatedBetween')
      .send({ planIds: [], afterId: firstPlanIdInternal })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body.data).to.be.an('array').of.length(0)
        expect(r.body.hitLimit).to.be.false
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET plansLastUpdatedBetween returns empty array for non-existent plans', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify(['non-existent-plan-1', 'non-existent-plan-2']),
        afterId: firstPlanIdInternal
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        expect(r.body.data).to.have.length(0)
        expect(r.body.hitLimit).to.be.false
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('plansLastUpdatedBetween works from a starting point', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]),
        afterId: firstPlanIdInternal,
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body.data[0].plan.jwtId).to.equal(secondPlanIdInternal)
        expect(r.body.data[0].plan.handleId).to.equal(secondPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore).to.be.undefined
        expect(r.body.data[1].plan.jwtId).to.equal(firstPlanClaim2IdInternal)
        expect(r.body.data[1].plan.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[1].wrappedClaimBefore).to.be.undefined
        expect(r.body.hitLimit).to.be.false
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('plansLastUpdatedBetween works from a starting point to an end point', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]),
        afterId: firstPlanIdInternal,
        beforeId: firstPlanClaim2IdInternal
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body.data).to.be.an('array').of.length(0)
        expect(r.body.hitLimit).to.be.false
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('v3 update plan description for plan #1', async () => {
    // Now can create this JWT with the ID that was assigned.
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = R.clone(testUtil.claimPlanAction)
    planObj.claim.agent.identifier = creds[1].did
    planObj.claim.lastClaimId = firstPlanClaim2IdInternal
    planObj.claim.description = ENTITY_NEW_DESC_2
    planObj.iss = creds[1].did
    const planJwtEnc = await credentials[1].createVerification(planObj)
    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: planJwtEnc})
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.status).that.equals(201)
      firstPlanClaim3IdInternal = r.body.success.claimId
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(5000)

  it('GET plansLastUpdatedBetween works with previous plan IDs', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]),
        afterId: firstPlanClaim2IdInternal,
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        expect(r.body.hitLimit).to.be.false
        // Should find the first plan's second claim since we're looking for changes after the first claim
        expect(r.body.data.length).to.equal(2)
        expect(r.body.data[0].plan.jwtId).to.equal(firstPlanClaim3IdInternal)
        expect(r.body.data[0].plan.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore.id).to.equal(firstPlanIdInternal)
        expect(r.body.data[0].wrappedClaimBefore.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore.claim.description).to.equal(testUtil.INITIAL_DESCRIPTION)
        expect(r.body.data[1].plan.jwtId).to.equal(secondPlanIdInternal)
        expect(r.body.data[1].plan.handleId).to.equal(secondPlanIdExternal)
        expect(r.body.data[1].wrappedClaimBefore).to.be.undefined
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET plansLastUpdatedBetween works with pagination', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify([firstPlanIdExternal, secondPlanIdExternal]),
        afterId: firstPlanIdInternal,
        beforeId: secondPlanIdInternal,
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        expect(r.body.hitLimit).to.be.a('boolean')
        // Doesn't find any because beforeId is before a later edit to the plan
        // ... which is not typically what a client would want.
        expect(r.body.data.length).to.equal(0)

      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('create a test plan for plansLastUpdatedBetween testing', async () => {
    const testPlanJwtObj = R.clone(testUtil.jwtTemplate)
    testPlanJwtObj.claim = R.clone(testUtil.claimPlanAction)
    testPlanJwtObj.claim.agent.identifier = creds[1].did
    testPlanJwtObj.claim.name = testPlanJwtObj.claim.name + " - for changes testing"
    testPlanJwtObj.claim.description = "Initial description for changes testing"
    testPlanJwtObj.iss = creds[1].did
    const testPlanJwtEnc = await credentials[1].createVerification(testPlanJwtObj)
    
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: testPlanJwtEnc})
      .then(r => {
        expect(r.status).to.equal(201)
        expect(r.body.success.claimId).to.be.a('string')
        expect(r.body.success.handleId).to.be.a('string')
        testPlanIdExternal = r.body.success.handleId  // external ID (handleId)
        testPlanIdInternal = r.body.success.claimId   // internal ID (claimId)
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('POST plansLastUpdatedBetween works with different boundaries', () => {
    return request(Server)
      .post('/api/v2/report/plansLastUpdatedBetween')
      .send({
        planIds: [firstPlanIdExternal, secondPlanIdExternal, planBy2FulfillsBy1Claim1IdExternal],
        afterId: secondPlanIdInternal,
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        expect(r.body.hitLimit).to.be.a('boolean')
        // Should find the first plan's second claim since we're looking for changes after the first claim
        expect(r.body.data.length).to.equal(2)
        expect(r.body.data[0].plan.jwtId).to.equal(firstPlanClaim3IdInternal)
        expect(r.body.data[0].plan.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore.id).to.equal(firstPlanClaim2IdInternal)
        expect(r.body.data[0].wrappedClaimBefore.handleId).to.equal(firstPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore.claim.description).to.equal(ENTITY_NEW_DESC)
        expect(r.body.data[1].plan.jwtId).to.equal(planBy2FulfillsBy1Claim3IdInternal)
        expect(r.body.data[1].plan.handleId).to.equal(planBy2FulfillsBy1Claim1IdExternal)
        expect(r.body.data[1].wrappedClaimBefore).to.be.undefined
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('update the test plan to create a change', async () => {
    const updatedPlanJwtObj = R.clone(testUtil.jwtTemplate)
    updatedPlanJwtObj.claim = R.clone(testUtil.claimPlanAction)
    updatedPlanJwtObj.claim.agent.identifier = creds[1].did
    updatedPlanJwtObj.claim.lastClaimId = testPlanIdInternal
    updatedPlanJwtObj.claim.name = updatedPlanJwtObj.claim.name + " - for changes testing"
    updatedPlanJwtObj.claim.description = "Updated description for changes testing"
    updatedPlanJwtObj.iss = creds[1].did
    const updatedPlanJwtEnc = await credentials[1].createVerification(updatedPlanJwtObj)
    
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: updatedPlanJwtEnc})
      .then(r => {
        expect(r.status).to.equal(201)
        expect(r.body.success.claimId).to.be.a('string')
        testPlanSecondClaimId = r.body.success.claimId
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('GET plansLastUpdatedBetween works with new plan', () => {
    return request(Server)
      .post('/api/v2/report/plansLastUpdatedBetween')
      .send({
        planIds: [testPlanIdExternal],
        afterId: testPlanIdInternal,
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        expect(r.body.hitLimit).to.be.a('boolean')
        // only finds the most recent claim
        // ... which usually isn't what a client would want.
        expect(r.body.data.length).to.equal(1)
        expect(r.body.data[0].plan.jwtId).to.equal(testPlanSecondClaimId)
        expect(r.body.data[0].plan.handleId).to.equal(testPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore).to.be.undefined
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

  it('GET plansLastUpdatedBetween finds changes after initial claim', () => {
    return request(Server)
      .get('/api/v2/report/plansLastUpdatedBetween')
      .query({
        planIds: JSON.stringify([testPlanIdExternal]),
        afterId: testPlanIdInternal
      })
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.have.property('data')
        expect(r.body).to.have.property('hitLimit')
        expect(r.body.data).to.be.an('array')
        // Should find exactly one change (the updated plan) since we're looking for changes after the initial claim
        expect(r.body.data.length).to.equal(1)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.data[0].plan.jwtId).to.equal(testPlanSecondClaimId)
        expect(r.body.data[0].plan.handleId).to.equal(testPlanIdExternal)
        expect(r.body.data[0].wrappedClaimBefore).to.be.undefined
      })
      .catch((err) => {
        return Promise.reject(err)
      })
  })

})
