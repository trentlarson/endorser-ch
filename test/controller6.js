
// Tests for Projects

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import dbService from '../server/api/services/endorser.db.service'
import { UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const PROJECT_1_INTERNAL_ID = 'puff-n-stuff'
const PROJECT_1_EXTERNAL_ID = 'https://endorser.ch/project/puff-n-stuff'

const projectBy1JwtObj = R.clone(testUtil.jwtTemplate)
projectBy1JwtObj.claim = R.clone(testUtil.claimProjectAction)
projectBy1JwtObj.claim.agent.identifier = creds[1].did
projectBy1JwtObj.claim.identifier = PROJECT_1_INTERNAL_ID
projectBy1JwtObj.iss = creds[1].did
const projectBy1JwtProm = credentials[1].createVerification(projectBy1JwtObj)

let pushTokens, projectBy1JwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller5 push tokens", pushTokens)
    })

  await Promise.all([projectBy1JwtProm])
    .then((jwts) => { [projectBy1JwtEnc] = jwts })

  return Promise.resolve()

})

describe('6 - Projects', () => {

  it('check insertion of project', async () => {
    await request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[1])
      .send({jwtEncoded: projectBy1JwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

  it('check access of project by external ID', async () => {
    await request(Server)
      .get('/api/ext/project/' + PROJECT_1_INTERNAL_ID)
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body.internalId).that.equals(PROJECT_1_INTERNAL_ID)
        expect(r.body.fullIri).that.equals(PROJECT_1_EXTERNAL_ID)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(5000)

})
