import chai from "chai";
import R from "ramda";
import request from "supertest";
import { Credentials } from "uport-credentials";

import Server from "../dist";
import { HIDDEN_TEXT, mergeTileCounts } from '../src/api/services/util';
import testUtil from "./util";

const expect = chai.expect

describe('P1 - mergeTileCounts', () => {
  it('handles array of unique tiles', () => {
    const tiles = [
      { indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 5 },
      { indexLat: 2, indexLon: 1, minFoundLat: 2.1, minFoundLon: 1.1, maxFoundLat: 2.2, maxFoundLon: 1.2, recordCount: 3 },
      { indexLat: 1, indexLon: 2, minFoundLat: 1.1, minFoundLon: 2.1, maxFoundLat: 1.2, maxFoundLon: 2.2, recordCount: 2 }
    ]

    const result = mergeTileCounts(tiles)
    expect(result).to.have.lengthOf(3)
    expect(result).to.deep.equal(tiles)
  })

  it('combines duplicate tiles by adding their counts', () => {
    const tiles = [
      { indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 5 },
      { indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 3 },
      { indexLat: 2, indexLon: 1, minFoundLat: 2.1, minFoundLon: 1.1, maxFoundLat: 2.2, maxFoundLon: 1.2, recordCount: 2 }
    ]

    const result = mergeTileCounts(tiles)
    expect(result).to.have.lengthOf(2)
    expect(result[0]).to.deep.equal({
      indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 8
    })
    expect(result[1]).to.deep.equal(tiles[2])
  })

  it('handles multiple sets of duplicates', () => {
    const tiles = [
      { indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 5 },
      { indexLat: 2, indexLon: 2, minFoundLat: 2.1, minFoundLon: 2.1, maxFoundLat: 2.2, maxFoundLon: 2.2, recordCount: 3 },
      { indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 2 },
      { indexLat: 2, indexLon: 2, minFoundLat: 2.1, minFoundLon: 2.1, maxFoundLat: 2.2, maxFoundLon: 2.2, recordCount: 4 }
    ]

    const result = mergeTileCounts(tiles)
    expect(result).to.have.lengthOf(2)
    expect(result).to.deep.include({
      indexLat: 1, indexLon: 1, minFoundLat: 1.1, minFoundLon: 1.1, maxFoundLat: 1.2, maxFoundLon: 1.2, recordCount: 7
    })
    expect(result).to.deep.include({
      indexLat: 2, indexLon: 2, minFoundLat: 2.1, minFoundLon: 2.1, maxFoundLat: 2.2, maxFoundLon: 2.2, recordCount: 7
    })
  })
})

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new Credentials(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens
before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})

describe('P1 - User Profiles', () => {
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
    locLon: -122.4194,
    locLat2: 41,
    locLon2: -73.5
  }

  it('cannot create a profile if not registered', () => {
    return request(Server)
      .post('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .send(profile0)
      .then(r => {
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create a profile with only description', () => {
    return request(Server)
      .post('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send(profile0)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create a profile with location', () => {
    return request(Server)
      .post('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send(profile1)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create another profile with nearby location', () => {
    return request(Server)
      .post('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send(profile2)
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  })

  it('can create a profile with distant location', () => {
    return request(Server)
    .post('/api/partner/userProfile')
    .set('Authorization', 'Bearer ' + pushTokens[3])
    .send(profile3)
    .then(r => {
      if (r.body.error) {
        throw new Error(JSON.stringify(r.body.error))
      }
      expect(r.body).to.have.property("success").that.is.an("object")
      expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
      expect(r.headers['content-type']).to.match(/json/)
      expect(r.status).that.equals(201)
    })
    .catch(err => {
      return Promise.reject(err)
    })
  })

  it('can create a profile again (but not a duplicate)', () => {
    return request(Server)
    .post('/api/partner/userProfile')
    .set('Authorization', 'Bearer ' + pushTokens[3])
    .send(profile3)
    .then(r => {
      if (r.body.error) {
        throw new Error(JSON.stringify(r.body.error))
      }
      expect(r.body).to.have.property("success").that.is.an("object")
      expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
      expect(r.headers['content-type']).to.match(/json/)
      expect(r.status).that.equals(201)
    })
    .catch(err => {
      return Promise.reject(err)
    })
  })

  it('can search profiles by description text', () => {
    return request(Server)
      .get('/api/partner/userProfile')
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
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLocLat: 40.7120,
        minLocLon: -74.0080,
        maxLocLat: 40.7140,
        maxLocLon: -74.0050
      })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(2)
        expect(r.body.data[0])
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  })

  it('can search profiles by location bounding box that matches one profile', () => {
    return request(Server)
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLocLat: 40.7125,
        minLocLon: -74.0065,
        maxLocLat: 40.7130,
        maxLocLon: -74.0055
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

  it('can search profiles by location bounding box that matches loc2 locations', () => {
    const lat1 = profile1.locLat
    const lon1 = profile1.locLon
    return request(Server)
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLocLat: lat1,
        minLocLon: lon1,
        maxLocLat: lat1 + 1.0,
        maxLocLon: lon1 + 1.0,
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

  it('returns empty array for location bounding box with no matches', () => {
    return request(Server)
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLocLat: 41.0000,
        minLocLon: -75.0000,
        maxLocLat: 42.0000,
        maxLocLon: -74.0000
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
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({
        minLocLat: 40.7120,
        minLocLon: -74.0080,
        maxLocLat: 40.7140,
        maxLocLon: -74.0050,
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
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .then(r => {
        expect(r.body.data).to.be.an('array').of.length(4)
        const hiddenProfile = r.body.data.find(p => p.description === profile0.description)
        expect(hiddenProfile).to.exist
        expect(hiddenProfile.rowId).to.equal(1)
        expect(hiddenProfile.issuerDid).to.equal('did:none:HIDDEN')
        expect(hiddenProfile).to.have.property('issuerDidVisibleToDids')
        expect(hiddenProfile.issuerDidVisibleToDids).to.be.an('array')
        expect(hiddenProfile.issuerDidVisibleToDids[0]).to.equal(creds[2].did)
        expect(r.status).that.equals(200)
      })
  })

  it('should verify issuerDidVisibleToDids array in profile response', () => {
    return request(Server)
      .get('/api/partner/userProfile?claimContents=remote')
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
      .get('/api/partner/userProfile')
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
      .post('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send(updatedProfile0)
      .then(r => {
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
  })

  it('should not find old profile content after update', () => {
    return request(Server)
      .get('/api/partner/userProfile')
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
      .get('/api/partner/userProfile')
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

  it('can retrieve own profile by DID', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[0].did)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        expect(r.body.data).to.be.an('object')
        expect(r.body.data.description).to.equal(updatedProfile0.description)
        expect(r.body.data.issuerDid).to.equal(creds[0].did)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
  })

  it('can retrieve another user profile by DID if visible', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[0].did)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.body.data.issuerDid).to.equal(creds[0].did)
        expect(r.body.data.description).to.equal(updatedProfile0.description)
        expect(r.body.data.issuerDid).to.equal(creds[0].did)
        expect(r.status).that.equals(200)
      })
  })

  it('can not retrieve any even if someone is between requester and profile', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[5])
      .then(r => {
        expect(r.body.data).to.be.undefined
        expect(r.status).that.equals(404)
      })
  })

  it('can not retrieve any if profile is not anywhere close', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[3].did)
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .then(r => {
        expect(r.body.data).to.be.undefined
        expect(r.status).that.equals(404)
      })
  })

  it('returns 404 when retrieving non-existent profile by DID', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[15].did) // Using creds[15] which hasn't created a profile
      .set('Authorization', 'Bearer ' + pushTokens[15])
      .then(r => {
        expect(r.status).that.equals(404)
      })
  })

  it('can delete a profile', () => {
    return request(Server)
      .delete('/api/partner/userProfile')
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
      .get('/api/partner/userProfile')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .query({ claimContents: 'Python' })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(0) // No results should be found
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)

        // Double check with a general search to make sure total number of profiles decreased
        return request(Server)
          .get('/api/partner/userProfile')
          .set('Authorization', 'Bearer ' + pushTokens[0])
      })
      .then(r => {
        expect(r.body.data).to.be.an('array')
        expect(r.body.data.length).to.equal(3) // Down from 4 profiles to 3
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
  })

  it('can retrieve profile by ID if owner', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        const profileId = r.body.data.rowId
        return request(Server)
          .get('/api/partner/userProfile/' + profileId)
          .set('Authorization', 'Bearer ' + pushTokens[1])
          .then(r => {
            expect(r.body.data).to.be.an('object')
            expect(r.body.data.description).to.equal(profile1.description)
            expect(r.body.data.issuerDid).to.equal(creds[1].did)
            expect(r.headers['content-type']).to.match(/json/)
            expect(r.status).that.equals(200)
          })
      })
  })

  it('can retrieve profile by ID if visible through network', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[1].did)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        const profileId = r.body.data.rowId
        return request(Server)
          .get('/api/partner/userProfile/' + profileId)
          .set('Authorization', 'Bearer ' + pushTokens[2])
          .then(r => {
            expect(r.body.data).to.be.an('object')
            expect(r.body.data.description).to.equal(profile1.description)
            expect(r.body.data.issuerDid).to.equal(creds[1].did)
            expect(r.status).that.equals(200)
          })
      })
  })

  it('can retrieve profile by ID if visible through more extended network', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[3].did)
      .set('Authorization', 'Bearer ' + pushTokens[3])
      .then(r => {
        const profileId = r.body.data.rowId
        return request(Server)
          .get('/api/partner/userProfile/' + profileId)
          .set('Authorization', 'Bearer ' + pushTokens[2])
          .then(r => {
            expect(r.body.data).to.be.an('object')
            expect(r.body.data.description).to.equal(profile3.description)
            expect(r.body.data.issuerDid).to.equal(HIDDEN_TEXT)
            expect(r.body.data.issuerDidVisibleToDids).to.be.an('array')
            expect(r.body.data.issuerDidVisibleToDids).to.include(creds[0].did)
            expect(r.status).that.equals(200)
          })
      })
  })

  it('cannot retrieve profile by ID if not visible', () => {
    return request(Server)
      .get('/api/partner/userProfileForIssuer/' + creds[3].did)
      .set('Authorization', 'Bearer ' + pushTokens[3])
      .then(r => {
        const profileId = r.body.data.rowId
        return request(Server)
          .get('/api/partner/userProfile/' + profileId)
          .set('Authorization', 'Bearer ' + pushTokens[15])
          .then(r => {
            expect(r.body.data.description).to.equal(profile3.description)
            expect(r.body.data.issuerDid).to.equal(HIDDEN_TEXT)
            expect(r.body.data.issuerDidVisibleToDids).to.be.an('array').that.is.empty
            expect(r.status).that.equals(200)
          })
      })
  })

  it('returns 404 when retrieving non-existent profile by ID', () => {
    return request(Server)
      .get('/api/partner/userProfile/999999')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.status).that.equals(404)
      })
  })

  describe('P1 - Profile Location Grid Tests', () => {
    it('retrieve profile counts inside bounding box containing multiple profiles', () => {
      // Use the location from profile1 as center point
      const lat = profile1.locLat
      const lon = profile1.locLon
      return request(Server)
        .get('/api/partner/userProfileCountsByBBox'
          + '?minLocLat=' + (lat - 0.1)
          + '&maxLocLat=' + (lat + 0.1)
          + '&minLocLon=' + (lon - 0.1)
          + '&maxLocLon=' + (lon + 0.1)
        )
        .then(r => {
          expect(r.headers['content-type']).to.match(/json/)
          expect(r.body.data.tiles).to.be.an('array')
          expect(r.body.data).to.have.property('minGridLat')
          expect(r.body.data).to.have.property('minGridLon')
          expect(r.body.data).to.have.property('tileWidth')
          expect(r.body.data).to.have.property('numTilesWide')

          // Should find at least one tile with 2 profiles (profile1 and profile2 are nearby)
          const tileWithMultipleProfiles = r.body.data.tiles.find(tile => tile.recordCount >= 2)
          expect(tileWithMultipleProfiles).to.exist
          expect(tileWithMultipleProfiles.minFoundLat).to.be.closeTo(lat, 0.1)
          expect(tileWithMultipleProfiles.minFoundLon).to.be.closeTo(lon, 0.1)
          expect(r.status).that.equals(200)
        })
    })

    it('retrieve profile counts inside bounding box containing one profile', () => {
      // Use the location from profile3 which is in San Francisco
      const lat = profile3.locLat
      const lon = profile3.locLon
      return request(Server)
        .get('/api/partner/userProfileCountsByBBox'
          + '?minLocLat=' + (lat - 0.01)
          + '&maxLocLat=' + (lat + 0.01)
          + '&minLocLon=' + (lon - 0.01)
          + '&maxLocLon=' + (lon + 0.01)
        )
        .then(r => {
          expect(r.headers['content-type']).to.match(/json/)
          expect(r.body.data.tiles).to.be.an('array')
          // Should find exactly one profile in one tile
          const tileWithProfile = r.body.data.tiles.find(tile => tile.recordCount === 1)
          expect(tileWithProfile).to.exist
          expect(tileWithProfile.minFoundLat).to.be.closeTo(lat, 0.1)
          expect(tileWithProfile.minFoundLon).to.be.closeTo(lon, 0.1)
          expect(tileWithProfile.maxFoundLat).to.be.closeTo(lat, 0.1)
          expect(tileWithProfile.maxFoundLon).to.be.closeTo(lon, 0.1)
          expect(r.status).that.equals(200)
        })
    })

    it('retrieve profile counts inside empty bounding box', () => {
      return request(Server)
        .get('/api/partner/userProfileCountsByBBox'
          + '?minLocLat=0'
          + '&maxLocLat=1'
          + '&minLocLon=0'
          + '&maxLocLon=1'
        )
        .then(r => {
          expect(r.headers['content-type']).to.match(/json/)
          expect(r.body.data.tiles).to.be.an('array')
          // Should find no profiles in any tiles
          const totalProfiles = r.body.data.tiles.reduce((sum, tile) => sum + tile.recordCount, 0)
          expect(totalProfiles).to.equal(0)
          expect(r.status).that.equals(200)
        })
    })

    it('handles invalid bounding box parameters', () => {
      return request(Server)
        .get('/api/partner/userProfileCountsByBBox'
          + '?minLocLat=invalid'
          + '&maxLocLat=91'  // Invalid latitude
          + '&minLocLon=-181' // Invalid longitude
          + '&maxLocLon=180'
        )
        .then(r => {
          expect(r.status).to.equal(400)
        })
    })
  })

}) 