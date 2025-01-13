import chai from "chai";
import R from "ramda";
import request from "supertest";
import { Credentials } from "uport-credentials";

import Server from "../dist";
import testUtil from "./util";

const expect = chai.expect

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new Credentials(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens
before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})

describe('9 - User Profiles', () => {
  // Test data
  const profile0 = {
    description: "Software developer interested in blockchain and decentralized systems",
  }

  const profile1 = {
    description: "Urban farmer looking to connect with local food enthusiasts",
    locLat: 40.7128,
    locLon: -74.0060
  }

  const profile2 = {
    description: "Blockchain developer and urban gardening enthusiast",
    locLat: 40.7138,
    locLon: -74.0070
  }

  const profile3 = {
    description: "Remote software developer",
    locLat: 37.7749,
    locLon: -122.4194
  }

  it('can create a profile with only description', () => {
    return request(Server)
      .post('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send(profile0)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create a profile with location', () => {
    return request(Server)
      .post('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send(profile1)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create another profile with nearby location', () => {
    return request(Server)
      .post('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send(profile2)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create a profile with distant location', () => {
    return request(Server)
      .post('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[3])
      .send(profile3)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can search profiles by description text', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({ claimContents: 'blockchain' })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(2)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('can search profiles by location bounding box that matches multiple profiles', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLat: 40.7120,
        minLon: -74.0080,
        maxLat: 40.7140,
        maxLon: -74.0050
      })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(2)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('can search profiles by location bounding box that matches one profile', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLat: 40.7125,
        minLon: -74.0065,
        maxLat: 40.7130,
        maxLon: -74.0055
      })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(1)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('returns empty array for location bounding box with no matches', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLat: 41.0000,
        minLon: -75.0000,
        maxLat: 42.0000,
        maxLon: -74.0000
      })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(0)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('can combine location and text search', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLat: 40.7120,
        minLon: -74.0080,
        maxLat: 40.7140,
        maxLon: -74.0050,
        claimContents: 'blockchain'
      })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(1)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('should verify did:none:HIDDEN replacement in profile response', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(4)
        const hiddenProfile = r.body.data.find(p => p.description === profile0.description)
        expect(hiddenProfile).to.exist
        expect(hiddenProfile.id).to.equal(1)
        expect(hiddenProfile.issuerDid).to.equal('did:none:HIDDEN')
        expect(hiddenProfile).to.have.property('issuerDidVisibleToDids')
        expect(hiddenProfile.issuerDidVisibleToDids).to.be.an('array')
        expect(hiddenProfile.issuerDidVisibleToDids[0]).to.equal(creds[2].did)
        expect(r.status).that.equals(200)
      })
  })

  it('should verify issuerDidVisibleToDids array in profile response', () => {
    return request(Server)
      .get('/api/partner/user-profile?claimContents=remote')
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(1)
        const hiddenProfile = r.body.data.find(p => p.description === profile3.description)
        expect(hiddenProfile).to.exist
        expect(hiddenProfile).to.not.have.property('issuerDidVisibleToDids')
        expect(r.status).that.equals(200)
      })
  })

  it('should verify original DID is visible to authorized users', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        expect(r.body.data).to.be.an('array')
        const visibleProfile = r.body.data.find(p => p.description === profile0.description)
        expect(visibleProfile).to.exist
        expect(visibleProfile.issuerDid).to.equal(creds[0].did)
        expect(r.status).that.equals(200)
      })
  })

  const updatedProfile0 = {
    description: "Python developer interested in AI and machine learning",
    locLat: 40.7128,
    locLon: -74.0060
  }

  it('can update an existing profile', () => {
    return request(Server)
      .post('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send(updatedProfile0)
      .then(r => {
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
  })

  it('should not find old profile content after update', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({ claimContents: 'blockchain' })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        // Should only find profile2 now since profile0 was updated
        expect(r.body.data.length).to.equal(1)
        expect(r.body.data[0].description).to.equal(profile2.description)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
  })

  it('should find new profile content after update', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({ claimContents: 'Python' })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(1)
        expect(r.body.data[0].description).to.equal(updatedProfile0.description)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
  })

  it('can delete a profile', () => {
    return request(Server)
      .delete('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        // for some reason the response has a body of {} and no content type
        // expect(r.body).to.have.property("success", true)
        // expect(r.body).to.have.property("deletedCount", 1)
        // expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(204)
      })
  })

  it('should not find deleted profile in search results', () => {
    return request(Server)
      .get('/api/partner/user-profile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({ claimContents: 'Python' })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(0) // No results should be found
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)

        // Double check with a general search to make sure total number of profiles decreased
        return request(Server)
          .get('/api/partner/user-profile')
          .set('Authorization', 'Bearer ' + pushTokens[0])
      })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(3) // Down from 4 profiles to 3
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
  })
}) 