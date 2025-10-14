// Tests for emoji functionality

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import request from 'supertest'
import R from 'ramda'
import { Credentials } from 'uport-credentials'

import Server from '../dist'
import testUtil from './util'

chai.use(chaiAsPromised)
const expect = chai.expect

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new Credentials(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens
before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})

describe('9 - Emoji Functionality', () => {

  let giveActionHandleId // Handle ID of a GiveAction to attach emojis to
  let giveActionClaimId // Internal claim ID of the GiveAction
  let firstEmojiClaimId // First emoji claim ID for testing
  let secondEmojiClaimId // Second emoji claim ID for testing

  // Create a GiveAction first that we can attach emojis to
  it('should create a GiveAction for emoji testing', async () => {
    const giveObj = R.clone(testUtil.jwtTemplate)
    giveObj.claim = R.clone(testUtil.claimGive)
    giveObj.claim.agent = { identifier: creds[0].did }
    giveObj.claim.recipient = { identifier: creds[1].did }
    giveObj.claim.description = "Help with moving furniture"
    giveObj.claim.object = {
      '@type': 'TypeAndQuantityNode',
      amountOfThisGood: 2,
      unitCode: 'HUR',
    }
    delete giveObj.claim.fulfills

    const jwt = await credentials[0].createVerification(giveObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({ jwtEncoded: jwt })
      .then(res => {
        expect(res.status).to.equal(201)
        expect(res.body.success).to.be.an('object')
        expect(res.body.error).to.be.undefined
        expect(res.body.success.handleId).to.be.a('string')
        expect(res.body.success.claimId).to.be.a('string')
        
        giveActionHandleId = res.body.success.handleId
        giveActionClaimId = res.body.success.claimId
      })
      .catch(err => Promise.reject(err));
  })



  describe('Emoji Claim Submission', () => {

    it('should successfully submit a valid emoji claim', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "👍",
        "parentItem": {
          "lastClaimId": giveActionClaimId
        }
      }

      const uportJwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: uportJwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.error).to.be.undefined
          expect(res.body.success.handleId).to.be.a('string')
          expect(res.body.success.claimId).to.be.a('string')
          expect(res.body.success.emojiId).to.be.a('number')
          expect(res.body.success.embeddedRecordError).to.be.undefined

          firstEmojiClaimId = res.body.success.claimId
        })
        .catch(err => Promise.reject(err))
    })

    it('should retrieve the first created emoji', async () => {
      return request(Server)
        .get(`/api/v2/report/emoji?parentHandleId=${encodeURIComponent(giveActionHandleId)}`)
        .set('Authorization', 'Bearer ' + pushTokens[5])
        .expect(200)
        .then(res => {
          expect(res.body.data).to.be.an('array')
          expect(res.body.data.length).to.equal(1)
          expect(res.body.hitLimit).to.not.be.true
          expect(res.body.data[0].jwtId).to.equal(firstEmojiClaimId)
        })
        .catch(err => Promise.reject(err));
    })

    it('should not create an emoji with bad context field', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://schema.org",
        "@type": "Emoji",
        "text": "🚀",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201) // created, but the embedded record had an error
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
          expect(res.body.success.embeddedRecordError).to.be.undefined // because it simply wasn't recognized
        })
        .then(() => {
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              expect(res.body.data).to.be.an('array')
              expect(res.body.data.length).to.equal(1)
              expect(res.body.hitLimit).to.not.be.true
              expect(res.body.data[0].jwtId).to.equal(firstEmojiClaimId)
            })
        })
        .catch(err => Promise.reject(err))
    })
      

    it('should reject emoji claim without text field', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {          
          expect(res.status).to.equal(201) // created, but the embedded record had an error
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
          expect(res.body.success.embeddedRecordError).to.be.a('string')
        })
        .catch(err => Promise.reject(err));
    })

    it('should reject emoji claim with empty text field', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201) // created, but the embedded record had an error
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
          expect(res.body.success.embeddedRecordError).to.be.a('string')
        })
        .catch(err => Promise.reject(err))
    })

    it('should reject emoji claim without lastClaimId', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "❤️"
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201) // created, but the embedded record had an error
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
          expect(res.body.success.embeddedRecordError).to.be.a('string')
        })
        .catch(err => Promise.reject(err))
    })

    it('should reject emoji claim with agent field', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "🚀",
        "parentItem": { "lastClaimId": giveActionClaimId },
        "agent": { identifier: creds[1].did }
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201) // created, but the embedded record had an error
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.embeddedRecordError).to.be.a('string')
        })
        .catch(err => Promise.reject(err))
    })
  })

  describe('Emoji Toggle Functionality', () => {

    it('should add a second different emoji from same user', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "❤️",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.handleId).to.be.a('string')
          
          secondEmojiClaimId = res.body.success.claimId
        })
        .then(() => {
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              expect(res.body.data).to.be.an('array')
              expect(res.body.data.length).to.equal(2)
              expect(res.body.hitLimit).to.not.be.true
            })
        })
        .catch(err => Promise.reject(err))
    })

    it('should toggle (remove) existing emoji when submitted again', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "👍", // Same emoji as first test
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201) // the JWT was created but hopefully the embedded record was deleted
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
        })
        .then(() => {
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              expect(res.body.data).to.be.an('array')
              expect(res.body.data.length).to.equal(1)
              expect(res.body.hitLimit).to.not.be.true
            })
        })
        .catch(err => Promise.reject(err))
    })

    it('should add emoji again after it was removed (toggle back)', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@type": "Emoji",
        "text": "👍", // Same emoji again
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.a('number')
        })
        .then(() => {
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              expect(res.body.data).to.be.an('array')
              expect(res.body.data.length).to.equal(2)
              expect(res.body.hitLimit).to.not.be.true
            })
        })
        .catch(err => Promise.reject(err))
    })

  })

  describe('Multiple Users and Emoji Counts', () => {

    it('should allow different users to add same emoji', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "text": "👍", // Same emoji as user 0
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[2].createVerification(emojiObj)
      return request(Server)
          .post('/api/v2/claim')
          .send({ jwtEncoded: jwt })
          .then(res => {            
            expect(res.status).to.equal(201)
            expect(res.body.success).to.be.an('object')
            expect(res.body.success.emojiId).to.be.a('number')
          })
        .catch(err => Promise.reject(err))
    })

    it('should allow third user to add different emoji', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "text": "🚀",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[3].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.a('number')
        })
        .then(() => {
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              expect(res.body.data).to.be.an('array')
              expect(res.body.data.length).to.equal(4)
              expect(res.body.hitLimit).to.not.be.true
            })
        })
        .catch(err => Promise.reject(err))
    })

  })

  describe('Emoji Retrieval Endpoint', () => {

    let beginningEmojiCount
    it('should retrieve all emojis for a parent item', async () => {
      return request(Server)
        .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .expect(200)
        .then(res => {
          expect(res.body.data).to.be.an('array')
          expect(res.body.data.length).to.equal(4)
          expect(res.body.hitLimit).to.be.undefined
          
          // Check structure of emoji records
          const firstEmoji = res.body.data[0]
          expect(firstEmoji).to.have.property('jwtId')
          expect(firstEmoji).to.have.property('issuerDid')
          expect(firstEmoji).to.have.property('text')
          expect(firstEmoji).to.have.property('parentItemHandleId')
          expect(firstEmoji.parentItemHandleId).to.equal(giveActionHandleId)

          beginningEmojiCount = res.body.data.length
        })
        .catch(err => Promise.reject(err))
    })

    it('should require parentHandleId parameter', async () => {
      return request(Server)
        .get('/api/v2/report/emoji')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(res => {
          expect(res.status).to.equal(400) // jwt was created although the embedded record had an error
          expect(res.body.error).to.not.be.undefined
        })
        .catch(err => Promise.reject(err))
    })

    it('should support pagination with beforeId', async () => {
      // First get all emojis to get an ID for pagination
      return request(Server)
        .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(res => {          
          const lastEmojiId = res.body.data[0].jwtId
          return lastEmojiId
        })
        .then(lastEmojiId => {
          // Now test pagination
          return request(Server)
            .get(`/api/v2/report/emoji?parentHandleId=${giveActionHandleId}&beforeId=${lastEmojiId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .then(res => {
              expect(res.body.data).to.be.an('array')
              // Should have fewer results due to beforeId filter
              expect(res.body.data.length).to.equal(beginningEmojiCount - 1)
            })
        })
        .catch(err => Promise.reject(err))
    })

  })

  describe('Emoji Count Integration', async () => {

    it('should include emoji counts in GiveAction retrieval', async () => {
      request(Server)
        .get(`/api/v2/report/gives?handleId=${giveActionHandleId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(res => {
          expect(res.status).to.equal(200)
          expect(res.body.data).to.be.an('array')
          expect(res.body.data.length).to.equal(1)
          
          const giveAction = res.body.data[0]
          expect(giveAction).to.have.property('emojiCount')
          expect(giveAction.emojiCount).to.be.an('object')
          
          // Should have counts for the emojis we added
          expect(giveAction.emojiCount['👍']).to.equal(2) // User 0 and User 1
          expect(giveAction.emojiCount['❤️']).to.equal(1) // User 0 only
          expect(giveAction.emojiCount['🚀']).to.equal(1) // User 2 only
        })
        .catch(err => Promise.reject(err))
    })

    it('should update emoji counts when emoji is removed', async () => {
      // Remove the heart emoji from user 0
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "text": "❤️",
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.undefined
        })
        .then(() => {
          // Now check that the count was updated
          return request(Server)
            .get(`/api/v2/report/gives?handleId=${giveActionHandleId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .expect(200)
            .then(res => {
              const giveAction = res.body.data[0]
              expect(giveAction.emojiCount['👍']).to.equal(2) // Still 2
              expect(giveAction.emojiCount['❤️']).to.be.undefined // Should be removed
              expect(giveAction.emojiCount['🚀']).to.equal(1) // Still 1
            })
        })
        .catch(err => Promise.reject(err))
    })

  })

  describe('Edge Cases and Error Handling', () => {

    it('should handle emoji on non-existent parent item gracefully', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "text": "😅",
        "parentItem": { "lastClaimId": "NONEXISTENT_JWT_ID" },
      }

      const jwt = await credentials[1].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          // The emoji should be created even if parent doesn't exist
          expect(res.body.error).to.not.be.undefined
        })
        .catch(err => Promise.reject(err))
    })

    it('should handle complex emoji characters', async () => {
      const emojiObj = R.clone(testUtil.jwtTemplate)
      emojiObj.claim = {
        "@context": "https://endorser.ch",
        "@type": "Emoji",
        "text": "👨‍💻", // Complex emoji with ZWJ (zero-width joiner)
        "parentItem": { "lastClaimId": giveActionClaimId },
      }

      const jwt = await credentials[3].createVerification(emojiObj)
      return request(Server)
        .post('/api/v2/claim')
        .send({ jwtEncoded: jwt })
        .then(res => {
          expect(res.status).to.equal(201)
          expect(res.body.success).to.be.an('object')
          expect(res.body.success.emojiId).to.be.a('number')
        })
        .catch(err => Promise.reject(err))
    })

    it('should retrieve emojis for non-existent parent (empty result)', async () => {
      return request(Server)
        .get('/api/v2/report/emoji?parentHandleId=http://endorser.ch/entity/NONEXISTENT')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(res => {
          expect(res.status).to.equal(200)
          expect(res.body.data).to.be.an('array')
          expect(res.body.data.length).to.equal(0)
          expect(res.body.hitLimit).to.not.be.true
        })
        .catch(err => Promise.reject(err))
    })

  })

})
