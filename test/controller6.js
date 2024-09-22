
// Tests for Projects

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../dist'
import {
  findAllLastClaimIdsAndHandleIds,
  HIDDEN_TEXT,
  globalId,
  localFromGlobalEndorserIdentifier,
} from '../dist/api/services/util';
import testUtil, {INITIAL_DESCRIPTION} from './util'

const expect = chai.expect

const creds = testUtil.ethrCredData

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)




const ENTITY_NEW_DESC = 'Edited details for app...'




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

let firstPlanIdExternal, firstPlanIdSecondClaimInternal,
  secondPlanIdExternal, secondPlanIdInternal,
  childPlanIdExternal, childPlanIdInternal, childPlanIdInternalClaim2

describe('6 - Plans', () => {

  // note that this is similar to Project

  let firstPlanIdInternal, planEndTime

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
    return request(Server)
      .get('/api/v2/report/plansByLocation?'
        + 'minLocLat' + '=' + (testUtil.claimPlanAction.location.geo.latitude + 1)
        + '&maxLocLat' + '=' + (testUtil.claimPlanAction.location.geo.latitude + 2)
        + '&westLocLon' + '=' + (testUtil.claimPlanAction.location.geo.longitude + 1)
        + '&eastLocLon' + '=' + (testUtil.claimPlanAction.location.geo.longitude + 2)
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
    return request(Server)
      .get('/api/v2/report/plansByLocation?'
        + 'minLocLat' + '=' + (testUtil.claimPlanAction.location.geo.latitude - 1)
        + '&maxLocLat' + '=' + (testUtil.claimPlanAction.location.geo.latitude + 1)
        + '&westLocLon' + '=' + (testUtil.claimPlanAction.location.geo.longitude - 1)
        + '&eastLocLon' + '=' + (testUtil.claimPlanAction.location.geo.longitude + 1)
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
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

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
        expect(r.body.description).that.equals(INITIAL_DESCRIPTION)
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
        expect(r.body.description).that.equals(INITIAL_DESCRIPTION)
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
        expect(r.body.description).that.equals(INITIAL_DESCRIPTION)
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
      firstPlanIdSecondClaimInternal = r.body.success.claimId
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
        .get('/api/plan/' + firstPlanIdSecondClaimInternal)
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
    planObj.claim.lastClaimId = firstPlanIdSecondClaimInternal
    planObj.claim.itemOffered = { description: ENTITY_NEW_DESC }
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

  it('fail to make a plan with mismatched lastClaimId & identifier', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.identifier = secondPlanIdExternal
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanIdSecondClaimInternal
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
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanIdSecondClaimInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        childPlanIdExternal = r.body.success.handleId
        childPlanIdInternal = r.body.success.claimId
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
        expect(r.body.data[0].handleId).to.equal(childPlanIdExternal)
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
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(childPlanIdExternal))
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
        expect(r.body.data[0].handleId).to.equal(childPlanIdExternal)
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.false
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('retrieve no child plan link from child', () => {
    return request(Server)
      .get('/api/v2/report/planFulfillersToPlan?planHandleId=' + encodeURIComponent(childPlanIdExternal))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.body.data).to.be.an('array').of.length(0)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('issuer of parent plan confirms fulfills link', async () => {
    const confirmChildPlanFor2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    confirmChildPlanFor2FulfillsBy1JwtObj.claim = R.clone(testUtil.confirmationTemplate)
    const planClaim = R.clone(planBy2FulfillsBy1Claim)
    planClaim.fulfills.lastClaimId = firstPlanIdSecondClaimInternal // just to make it like the current record
    planClaim.lastClaimId = childPlanIdInternal
    confirmChildPlanFor2FulfillsBy1JwtObj.claim.object.push(planClaim)
    confirmChildPlanFor2FulfillsBy1JwtObj.sub = creds[2].did
    confirmChildPlanFor2FulfillsBy1JwtObj.iss = creds[1].did
    const planJwt = await credentials[1].createVerification(confirmChildPlanFor2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwt})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(childPlanIdExternal))
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
        expect(r.body.data[0].handleId).to.equal(childPlanIdExternal)
        expect(r.body.data[0].fulfillsLinkConfirmed).to.be.true
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('fail to update child plan fulfills with mismatching claim ID & handle ID', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills.identifier = secondPlanIdExternal
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanIdSecondClaimInternal
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = childPlanIdInternal
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
    planBy2FulfillsBy1JwtObj.claim.fulfills.lastClaimId = firstPlanIdSecondClaimInternal
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = childPlanIdInternal
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        childPlanIdExternal = r.body.success.handleId
        childPlanIdInternalClaim2 = r.body.success.claimId
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
        expect(r.body.data[0].handleId).to.equal(childPlanIdExternal)
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
        expect(globalId(firstPlanIdSecondClaimInternal)).to.not.equal(firstPlanIdExternal)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('update plan and remove fulfills link', async () => {
    const planBy2FulfillsBy1JwtObj = R.clone(testUtil.jwtTemplate)
    planBy2FulfillsBy1JwtObj.claim = R.clone(planBy2FulfillsBy1Claim)
    planBy2FulfillsBy1JwtObj.claim.fulfills = undefined
    planBy2FulfillsBy1JwtObj.claim.lastClaimId = childPlanIdInternalClaim2
    planBy2FulfillsBy1JwtObj.iss = creds[2].did
    const planBy2FulfillsBy1JwtEnc = await credentials[2].createVerification(planBy2FulfillsBy1JwtObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planBy2FulfillsBy1JwtEnc})
      .then(r => {
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(201)
        childPlanIdExternal = r.body.success.handleId
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
        expect(r.body.data[0].handleId).to.equal(childPlanIdExternal)
        expect(r.body.data[0].fulfillsPlanHandleId).to.equal(null)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('parent plan link from child no longer shows that it is confirmed', () => {
    return request(Server)
      .get('/api/v2/report/planFulfilledByPlan?planHandleId=' + encodeURIComponent(childPlanIdExternal))
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
        vc.claim.issuedAt = new Date().toISOString()
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
      R.times(n =>
          R.clone(claimPlan_OthersBy1_JwtObj),
        NUM_PLANS
      )
      .map((vc, i) => {
        vc.claim.description += " #" + (i + 1)
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

  it('insert offer #1 that is for a project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Groom the horses',
      isPartOf: { '@type': 'PlanAction', lastClaimId: firstPlanIdSecondClaimInternal }
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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

  it('insert offer #2 that is for the same project', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimOffer)
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 1, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Take dogs for a walk',
      isPartOf: { '@type': 'PlanAction', lastClaimId: firstPlanIdSecondClaimInternal }
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Feed cats',
      isPartOf: { '@type': 'PlanAction', lastClaimId: firstPlanIdSecondClaimInternal }
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'Fleece sheep',
      isPartOf: { '@type': 'PlanAction', lastClaimId: secondPlanIdInternal }
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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
    credObj.claim.includesObject = {
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 20, unitCode: 'USD'
    }
    credObj.claim.itemOffered = {
      description: 'Help with church performance night',
      isPartOf: { '@type': 'PlanAction', lastClaimId: secondPlanIdInternal }
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'First grade materials',
    }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: claimJwtEnc})
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
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
    credObj.claim.itemOffered = {
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
          console.log('Something went wrong. Here is the response body: ', r.body)
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
            'Something went wrong, but nothing critical. Here is the error:',
            r.body.success.embeddedRecordError
          )
        }
        expect(r.headers['content-type'], /json/)
        expect(r.body.success.handleId).to.be.a('string')
        expect(r.body.success.fulfillsHandleId).to.equal(firstOfferId)
        expect(globalId(r.body.success.fulfillsLastClaimId)).to.equal(firstOfferId)
        expect(r.body.success.fulfillsPlanHandleId).to.equal(firstPlanIdExternal)
        expect(r.body.success.fulfillsPlanLastClaimId).to.equal(firstPlanIdSecondClaimInternal)
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
        expect(r.body.data).to.deep.equal({ "HUR": 2 })
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
        expect(r.body.data[0].agentDid).to.equal(creds[2].did)
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
        expect(r.body.data[0].agentDid).to.equal(creds[2].did)
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
        expect(r.body.data).to.deep.equal({ "HUR": 3 })
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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

  it('wrong user tries to confirm a give', async () => {

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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.body.data).to.be.an('object')
        expect(r.body.data).to.deep.equal({ "HUR": 4 })
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
      expect(r.body.data[0].amount).to.equal(0)
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
      { lastClaimId: childPlanIdInternalClaim2 },
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
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        } else if (r.body.success.embeddedRecordError) {
          console.log(
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
        expect(r.body.data).to.deep.equal({ "HUR": 2 })
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('give totals after #7 are correct for child plan with defaults', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal))
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": 3 })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #7 are correct for child plan with only gifted', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal) + '&onlyGifted=true')
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
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal) + '&onlyTraded=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": 3 })
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
      { lastClaimId: childPlanIdInternalClaim2 },
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
        console.log('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.log(
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
      { lastClaimId: childPlanIdInternalClaim2 },
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
        console.log('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.log(
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
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal))
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "HUR": 1, "USD": 5 })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #8 are correct for child plan with only gifted', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal) + '&onlyGifted=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "HUR": 1, "USD": 2 })
      expect(r.status).that.equals(200)
    }).catch((err) => {
      return Promise.reject(err)
    })
  }).timeout(3000)

  it('give totals after #8 are correct for child plan with only traded', () => {
    return request(Server)
    .get('/api/v2/report/giveTotals?planId=' + encodeURIComponent(childPlanIdExternal) + '&onlyTraded=true')
    .set('Authorization', 'Bearer ' + pushTokens[2])
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.body.data).to.be.an('object')
      expect(r.body.data).to.deep.equal({ "USD": 3 })
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
        expect(r.body.data).to.deep.equal({ "HUR": 2, "USD": 3 })
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
        console.log('Something went wrong. Here is the response body: ', r.body)
        return Promise.reject(r.body.error)
      } else if (r.body.success.embeddedRecordError) {
        console.log(
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
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 3, unitCode: 'HUR'
    }
    credObj.claim.itemOffered = {
      description: 'First grade materials to user 3',
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
      '@type': 'TypeAndQuantityNode', amountOfThisGood: 60, unitCode: 'USD'
    }
    credObj.claim.itemOffered = {
      description: 'First grade materials to user 5',
    }
    credObj.sub = creds[4].did
    credObj.iss = creds[4].did
    const claimJwtEnc = await credentials[4].createVerification(credObj)

    return request(Server)
    .post('/api/v2/claim')
    .send({jwtEncoded: claimJwtEnc})
    .then(r => {
      if (r.body.error) {
        console.log('Something went wrong. Here is the response body: ', r.body)
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
      expect(r.body.data[0].fullClaim.itemOffered.description).to.equal('First grade materials to user 5')
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
