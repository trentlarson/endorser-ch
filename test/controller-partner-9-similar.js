// Tests for semantic matching: the embedding sweep, /similar, and the vector export endpoints.
// Depends on the endorser tests for registrations, and on controller-partner-1 for creds[1]'s profile.

import chai from "chai";
import R from "ramda";
import request from "supertest";
import { Credentials } from "uport-credentials";

import Server from "../dist";
import { dbService as partnerDbService } from "../dist/api/services/partner.db.service";
import { activeEmbeddingSpec } from "../dist/api/services/embedding-specs";
import { base64ToVector, contentHash, dot, subjectText } from "../dist/api/services/embedding-engine";
import { HIDDEN_TEXT } from "../src/api/services/util";
import testUtil from "./util";

const expect = chai.expect

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new Credentials(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens
let unregisteredToken
before(async () => {
  pushTokens = await Promise.all(pushTokenProms)
  const stranger = Credentials.createIdentity()
  unregisteredToken = await new Credentials(stranger).createVerification({ exp: testUtil.nextMinuteEpoch })
})

// an area no other test uses
const BBOX = { minLocLat: 10, minLocLon: 20, maxLocLat: 10.3, maxLocLon: 20.3 }

const GARDEN_PLAN = {
  name: 'Neighborhood Vegetable Garden',
  description: 'Shared raised beds for growing organic vegetables, with monthly composting workshops.',
  latitude: 10.1,
  longitude: 20.1,
}
const CODING_PLAN = {
  name: 'Open Source Coding Club',
  description: 'Weekly meetups to build web applications with JavaScript and Python.',
  latitude: 10.2,
  longitude: 20.2,
}
const GARDENER_PROFILE = {
  description: 'I grow tomatoes and squash in my backyard and love swapping seeds with neighbors.',
  locLat: 10.15,
  locLon: 20.15,
}
// inside the box only through its second location
const CODER_PROFILE = {
  description: 'Backend software engineer; I write Python and JavaScript and mentor new programmers.',
  locLat: 50,
  locLon: 50,
  locLat2: 10.25,
  locLon2: 20.25,
}

function planJwt(plan) {
  const claim = R.clone(testUtil.claimPlanAction)
  claim.agent.identifier = creds[1].did
  claim.name = plan.name
  claim.description = plan.description
  claim.location = { geo: { "@type": "GeoCoordinates", latitude: plan.latitude, longitude: plan.longitude } }
  const jwtObj = R.clone(testUtil.jwtTemplate)
  jwtObj.claim = claim
  jwtObj.sub = creds[1].did
  jwtObj.iss = creds[1].did
  return credentials[1].createVerification(jwtObj)
}

function similar(token, query) {
  return request(Server).get('/api/partner/similar').set('Authorization', 'Bearer ' + token).query(query)
}

describe('P9 - Semantic Matching', () => {

  const adminDid = creds[0].did
  let gardenHandleId, codingHandleId
  let gardenerRowId, coderRowId

  before(() => {
    process.env.ADMIN_DIDS = JSON.stringify([adminDid])
  })

  after(() => {
    delete process.env.ADMIN_DIDS
    delete process.env.EMBEDDING_QUERY_MAX_PER_MINUTE
  })

  describe('Setup and sweep', () => {

    it('creates two plans, which get no embedding until a sweep', async () => {
      for (const plan of [GARDEN_PLAN, CODING_PLAN]) {
        const r = await request(Server).post('/api/v2/claim').send({ jwtEncoded: await planJwt(plan) })
        expect(r.status).to.equal(201)
        if (plan === GARDEN_PLAN) {
          gardenHandleId = r.body.success.handleId
        } else {
          codingHandleId = r.body.success.handleId
        }
      }
      const stored = await partnerDbService.embeddingsBySubjects('plan', activeEmbeddingSpec().embeddingSpecId, [gardenHandleId])
      expect(stored).to.have.length(0)
    }).timeout(10000)

    it('creates two profiles, embedded on save', async () => {
      for (const [index, profile] of [[7, GARDENER_PROFILE], [8, CODER_PROFILE]]) {
        const r = await request(Server)
          .post('/api/partner/userProfile')
          .set('Authorization', 'Bearer ' + pushTokens[index])
          .send(profile)
        expect(r.status).to.equal(201)
        expect(r.body.userMessage).to.be.undefined
      }
      gardenerRowId = (await partnerDbService.profileByIssuerDid(creds[7].did)).rowid
      coderRowId = (await partnerDbService.profileByIssuerDid(creds[8].did)).rowid
    }).timeout(30000)

    it('does not let a non-admin see or start the sweep', async () => {
      let r = await request(Server).get('/api/partner/embeddingSweep').set('Authorization', 'Bearer ' + pushTokens[1])
      expect(r.status).to.equal(403)
      r = await request(Server).post('/api/partner/embeddingSweep').set('Authorization', 'Bearer ' + pushTokens[1])
      expect(r.status).to.equal(403)
    })

    it('embeds the plans in a sweep, and fixes missing and orphaned vectors', async () => {
      const specId = activeEmbeddingSpec().embeddingSpecId
      // a vector for a profile that doesn't exist, and a missing vector for one that does
      await partnerDbService.embeddingUpsert('profile', '999999', specId, 'not-a-real-hash', Buffer.alloc(4 * 256))
      await partnerDbService.embeddingDeleteBySubject('profile', String(gardenerRowId))

      const r = await request(Server)
        .post('/api/partner/embeddingSweep')
        .query({ wait: 'true' })
        .set('Authorization', 'Bearer ' + pushTokens[0])
      expect(r.status).to.equal(200)
      expect(r.body.data.running).to.equal(false)
      expect(r.body.data.lastError).to.equal(null)
      const result = r.body.data.lastResult
      expect(result.embeddingSpecId).to.equal(specId)
      expect(result.plan.embedded).to.be.at.least(2)
      expect(result.profile.embedded).to.be.at.least(1)
      expect(result.profile.deleted).to.be.at.least(1)

      expect(await partnerDbService.embeddingsBySubjects('profile', specId, ['999999'])).to.have.length(0)
      expect(await partnerDbService.embeddingsBySubjects('profile', specId, [String(gardenerRowId)])).to.have.length(1)
      expect(await partnerDbService.embeddingsBySubjects('plan', specId, [gardenHandleId, codingHandleId])).to.have.length(2)
    }).timeout(60000)

    it('finds nothing to change in a second sweep', async () => {
      const r = await request(Server)
        .post('/api/partner/embeddingSweep')
        .query({ wait: 'true' })
        .set('Authorization', 'Bearer ' + pushTokens[0])
      const result = r.body.data.lastResult
      expect(result.profile.embedded + result.profile.deleted + result.plan.embedded + result.plan.deleted).to.equal(0)
      expect(result.plan.current).to.be.at.least(2)
    }).timeout(60000)

    it('shows the sweep status and counts to an admin', async () => {
      const r = await request(Server).get('/api/partner/embeddingSweep').set('Authorization', 'Bearer ' + pushTokens[0])
      expect(r.status).to.equal(200)
      expect(r.body.data.lastFinishedAt).to.be.a('string')
      const counts = Object.fromEntries(r.body.data.counts.map((c) => [c.subjectType, c.count]))
      expect(counts.profile).to.be.at.least(2)
      expect(counts.plan).to.be.at.least(2)
    })
  })

  describe('GET /similar', () => {

    it('requires authorization', async () => {
      const r = await request(Server).get('/api/partner/similar').query({ from: 'text:garden' })
      expect(r.status).to.equal(400)
    })

    it('rejects bad parameters', async () => {
      expect((await similar(pushTokens[0], { from: 'garden' })).status).to.equal(400)
      expect((await similar(pushTokens[0], { from: 'profile:abc' })).status).to.equal(400)
      expect((await similar(pushTokens[0], { from: 'text:garden', to: 'people' })).status).to.equal(400)
      expect((await similar(pushTokens[0], { from: 'text:garden', minLocLat: 10 })).status).to.equal(400)
      expect((await similar(pushTokens[0], { from: 'text:garden', minSimilarity: 2 })).status).to.equal(400)
      expect((await similar(pushTokens[0], { from: 'text:garden', limit: 0 })).status).to.equal(400)
    })

    it('returns 404 for a source without an embedding', async () => {
      const r = await similar(pushTokens[0], { from: 'profile:999999' })
      expect(r.status).to.equal(404)
    })

    it('profile -> plans: the garden plan ranks above the coding plan for the gardener', async () => {
      const r = await similar(pushTokens[0], { from: 'profile:' + gardenerRowId, to: 'plan', minSimilarity: -1, ...BBOX })
      expect(r.status).to.equal(200)
      expect(r.body.embeddingSpecId).to.equal(activeEmbeddingSpec().embeddingSpecId)
      expect(r.body.data.map((d) => d.subjectId)).to.deep.equal([gardenHandleId, codingHandleId])
      expect(r.body.data[0].subjectType).to.equal('plan')
      expect(r.body.data[0].similarity).to.be.above(r.body.data[1].similarity)
      expect(r.body.data[0].record.name).to.equal(GARDEN_PLAN.name)
    })

    it('plan -> profiles: matches profiles inside the box by either location', async () => {
      const r = await similar(pushTokens[0], { from: 'plan:' + codingHandleId, to: 'profile', minSimilarity: -1, ...BBOX })
      expect(r.status).to.equal(200)
      // the coder is in the box only through locLat2/locLon2
      expect(r.body.data.map((d) => d.subjectId)).to.deep.equal([String(coderRowId), String(gardenerRowId)])
      expect(r.body.data[0].record.description).to.equal(CODER_PROFILE.description)
    })

    it('plan -> plans and profile -> profiles: never returns the source itself', async () => {
      let r = await similar(pushTokens[0], { from: 'plan:' + gardenHandleId, to: 'plan', minSimilarity: -1, ...BBOX })
      expect(r.body.data.map((d) => d.subjectId)).to.deep.equal([codingHandleId])
      r = await similar(pushTokens[0], { from: 'profile:' + gardenerRowId, to: 'profile', minSimilarity: -1, ...BBOX })
      expect(r.body.data.map((d) => d.subjectId)).to.deep.equal([String(coderRowId)])
    })

    it('text -> both: ranks the garden subjects above the coding ones', async () => {
      const r = await similar(pushTokens[1], { from: 'text:vegetable gardening', minSimilarity: -1, ...BBOX })
      expect(r.status).to.equal(200)
      const ids = r.body.data.map((d) => d.subjectType + ':' + d.subjectId)
      expect(ids).to.have.length(4)
      expect(ids.slice(0, 2)).to.have.members(['plan:' + gardenHandleId, 'profile:' + gardenerRowId])
    }).timeout(10000)

    it('applies the spec default minimum similarity and the limit', async () => {
      const all = await similar(pushTokens[1], { from: 'plan:' + gardenHandleId, minSimilarity: -1, limit: 50 })
      expect(all.body.data.length).to.be.at.least(4)
      const defaulted = await similar(pushTokens[1], { from: 'plan:' + gardenHandleId, limit: 50 })
      const minimum = activeEmbeddingSpec().matching.minimumSimilarity
      defaulted.body.data.forEach((d) => expect(d.similarity).to.be.at.least(minimum))
      const limited = await similar(pushTokens[1], { from: 'plan:' + gardenHandleId, minSimilarity: -1, limit: 1 })
      expect(limited.body.data).to.have.length(1)
    })

    it('hides DIDs the requester cannot see', async () => {
      // creds[5] cannot see creds[1], who issued the plans (see controller-partner-1)
      const r = await similar(pushTokens[5], { from: 'profile:' + gardenerRowId, to: 'plan', minSimilarity: -1, ...BBOX })
      expect(r.status).to.equal(200)
      const garden = r.body.data.find((d) => d.subjectId === gardenHandleId)
      expect(garden.record.issuerDid).to.equal(HIDDEN_TEXT)
      expect(JSON.stringify(r.body)).to.not.include(creds[1].did)
    })

    it('requires registration for text queries', async () => {
      const r = await similar(unregisteredToken, { from: 'text:gardening' })
      expect(r.status).to.equal(400)
      expect(r.body.error.userMessage).to.include('registered')
    })

    it('rate limits text queries', async () => {
      process.env.EMBEDDING_QUERY_MAX_PER_MINUTE = '2'
      expect((await similar(pushTokens[2], { from: 'text:gardening', ...BBOX })).status).to.equal(200)
      expect((await similar(pushTokens[2], { from: 'text:gardening', ...BBOX })).status).to.equal(200)
      expect((await similar(pushTokens[2], { from: 'text:gardening', ...BBOX })).status).to.equal(429)
      // stored-vector queries are not limited
      expect((await similar(pushTokens[2], { from: 'plan:' + gardenHandleId, ...BBOX })).status).to.equal(200)
      delete process.env.EMBEDDING_QUERY_MAX_PER_MINUTE
    }).timeout(10000)
  })

  describe('Profiles without text', () => {

    it('drops the vector when a profile is saved with an empty description', async () => {
      let r = await request(Server)
        .post('/api/partner/userProfile')
        .set('Authorization', 'Bearer ' + pushTokens[7])
        .send({ ...GARDENER_PROFILE, description: '   ' })
      expect(r.status).to.equal(201)
      expect(r.body.userMessage).to.be.undefined
      r = await request(Server)
        .get('/api/partner/userProfileEmbeddingMetadata/' + creds[7].did)
        .set('Authorization', 'Bearer ' + pushTokens[7])
      expect(r.body.data.hasCurrentEmbedding).to.equal(false)
      expect((await similar(pushTokens[0], { from: 'profile:' + gardenerRowId })).status).to.equal(404)
    })

    it('embeds it again when text comes back', async () => {
      const r = await request(Server)
        .post('/api/partner/userProfile')
        .set('Authorization', 'Bearer ' + pushTokens[7])
        .send(GARDENER_PROFILE)
      expect(r.status).to.equal(201)
      expect((await similar(pushTokens[0], { from: 'profile:' + gardenerRowId, ...BBOX })).status).to.equal(200)
    })
  })

  describe('Vector export', () => {

    it('describes the active spec and where clients get its model', async () => {
      const r = await request(Server).get('/api/partner/embeddingSpecs')
      expect(r.status).to.equal(200)
      const spec = activeEmbeddingSpec()
      expect(r.body.activeEmbeddingSpecId).to.equal(spec.embeddingSpecId)
      expect(r.body.data[0].dimensions).to.equal(spec.dimensions)
      expect(r.body.data[0].artifact.baseUrl).to.include(spec.modelRevision)
      expect(r.body.data[0].artifact.fileSha256).to.deep.equal(spec.fileSha256)
    })

    it('requires authorization and a subject type', async () => {
      expect((await request(Server).get('/api/partner/embeddings').query({ subjectType: 'plan' })).status).to.equal(400)
      const r = await request(Server).get('/api/partner/embeddings').set('Authorization', 'Bearer ' + pushTokens[0])
      expect(r.status).to.equal(400)
      const unknown = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'plan', embeddingSpecId: 'nope' })
      expect(unknown.status).to.equal(400)
    })

    it('exports plan vectors in the box, with hashes a client can reproduce', async () => {
      const spec = activeEmbeddingSpec()
      const r = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'plan', ...BBOX })
      expect(r.status).to.equal(200)
      expect(r.body.embeddingSpecId).to.equal(spec.embeddingSpecId)
      expect(r.body.hitLimit).to.equal(false)
      expect(r.body.data.map((d) => d.subjectId)).to.have.members([gardenHandleId, codingHandleId])
      const garden = r.body.data.find((d) => d.subjectId === gardenHandleId)
      expect(garden.contentHash).to.equal(contentHash(subjectText(spec, 'plan', GARDEN_PLAN)))
      const vector = base64ToVector(garden.vector)
      expect(vector).to.have.length(spec.dimensions)
      expect(dot(vector, vector)).to.be.closeTo(1, 1e-5)
      expect(JSON.stringify(r.body)).to.not.include('did:')
    })

    it('pages through profile vectors by subjectId', async () => {
      const page1 = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'profile', ...BBOX, limit: 1 })
      expect(page1.body.data).to.have.length(1)
      expect(page1.body.hitLimit).to.equal(true)
      const page2 = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'profile', ...BBOX, limit: 1, afterId: page1.body.data[0].subjectId })
      expect(page2.body.data).to.have.length(1)
      expect([page1.body.data[0].subjectId, page2.body.data[0].subjectId])
        .to.have.members([String(gardenerRowId), String(coderRowId)])
      const page3 = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'profile', ...BBOX, limit: 1, afterId: page2.body.data[0].subjectId })
      expect(page3.body.data).to.have.length(0)
    })

    it('pages through all vectors without a box', async () => {
      const r = await request(Server)
        .get('/api/partner/embeddings')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .query({ subjectType: 'plan', limit: 500 })
      expect(r.status).to.equal(200)
      const ids = r.body.data.map((d) => d.subjectId)
      expect(ids).to.include.members([gardenHandleId, codingHandleId])
      expect([...ids].sort()).to.deep.equal(ids)
    })
  })

})
