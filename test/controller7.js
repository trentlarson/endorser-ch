import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
const crypto = require('crypto')
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import {
  cacheContactList,
  clearContactCaches,
  getContactMatch,
  RESULT_ALL_CLEARED,
  RESULT_NEED_APPROVAL,
  RESULT_NEED_BOTH_USER_DATA,
  RESULT_NEED_COUNTERPARTY_DATA,
  RESULT_NEED_THIS_USER_DATA,
  RESULT_ONE_CLEARED,
}
  from "../server/api/services/contact-correlation.service"
import Server from '../server'
import { HIDDEN_TEXT } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect
const RESULT_NO_MATCH = { matches: [] }

const hashDidWithPass = (pass) => (did) => {
  const hash = crypto.createHash('sha256');
  hash.update(did + pass)
  return hash.digest('hex')
}

const user1Contacts = [
  'did:test:zippidee', 'did:test:doo', 'did:test:dah', 'did:test:yay'
]
const user2Contacts1 = [
  'did:test:my-oh-my', 'did:test:what-a-wonderful', 'did:test:day'
]
const user2Contacts2 = [
  'did:test:my-oh-my', 'did:test:what-a-wonderful', 'did:test:yay'
]
const password = '123987'
const user1ContactsHashed = R.map(hashDidWithPass(password), user1Contacts)
const user2Contacts1Hashed = R.map(hashDidWithPass(password), user2Contacts1)
const user2Contacts2Hashed = R.map(hashDidWithPass(password), user2Contacts2)
const user2Contacts3Hashed = R.map(hashDidWithPass('bad-pass'), user2Contacts2)
const matchingContactDid = hashDidWithPass(password)('did:test:yay')
const user2ContactsHashedMatching = [user2Contacts1Hashed[0], user2Contacts1Hashed[1]]

it('contact lists can match', () => {
  const user1 = 'did:test:abc'
  const user2 = 'did:test:def'
  const user3 = 'did:test:xyz'

  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA})

  // non-match for empty list
  expect(cacheContactList(user1, user2, [])).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user3)).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA})

  // various errors for repeated input
  expect(cacheContactList(user1, user2, user1ContactsHashed))
    .with.property('error')
    .with.property('message')
  expect(cacheContactList(user2, user1, user1ContactsHashed))
      .with.property('error')
      .with.property('message')

  // clear caches
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ALL_CLEARED})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ONE_CLEARED})
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_ONE_CLEARED})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA})

  // non-match for lack of matches
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA})
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})

  // non-match w/ bad password
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ALL_CLEARED})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA})
  expect(cacheContactList(user2, user1, user2Contacts3Hashed)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})

  // now get match
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ALL_CLEARED})
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user2, user1, user2Contacts2Hashed)).to.deep.equal({data: {matches: [matchingContactDid]} })
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {matches: [matchingContactDid]} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {matches: [matchingContactDid]} })

  // user 1 still gets match if user2 removes match immediately
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ALL_CLEARED})
  expect(cacheContactList(user2, user1, user2Contacts2Hashed)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: {matches: [matchingContactDid]}})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {matches: [matchingContactDid]} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {matches: [matchingContactDid]} })
  expect(cacheContactList(user2, user1, [])).with.property('error').with.property('message')
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {matches: [matchingContactDid]} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {matches: [matchingContactDid]} })

  // multiple matches work
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_ALL_CLEARED}) // other user is already cleared
  expect(cacheContactList(user1, user2, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user2, user1, user2Contacts2Hashed)).to.deep.equal(
    { data: { matches: user2ContactsHashedMatching } }
  )
  expect(getContactMatch(user1, user2)).to.deep.equal(
    { data: { matches: user2ContactsHashedMatching } }
  )
  expect(getContactMatch(user2, user1)).to.deep.equal(
    { data: { matches: user2ContactsHashedMatching } }
  )
  // now repeat, just to show results are still there
  expect(getContactMatch(user1, user2)).to.deep.equal(
    { data: { matches: user2ContactsHashedMatching } }
  )
  expect(getContactMatch(user2, user1)).to.deep.equal(
    { data: { matches: user2ContactsHashedMatching } }
  )
  expect(getContactMatch(user2, user1).data.onlyOneMatch).to.be.undefined

  // single, randomized match works
  expect(clearContactCaches(user1, user2)).to.deep.equal({success: RESULT_NEED_APPROVAL})
  expect(clearContactCaches(user2, user1)).to.deep.equal({success: RESULT_ALL_CLEARED})
  expect(cacheContactList(user1, user2, user2Contacts1Hashed, true))
    .to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
  expect(cacheContactList(user2, user1, user2Contacts2Hashed).data.matches[0])
    .to.be.oneOf(user2ContactsHashedMatching)
  expect(getContactMatch(user1, user2).data.matches).with.length(1)
  expect(getContactMatch(user1, user2).data.matches[0]).to.be.oneOf(user2ContactsHashedMatching)
  expect(getContactMatch(user2, user1).data.matches[0]).to.be.oneOf(user2ContactsHashedMatching)
  // now repeat, just to show results are still there
  expect(getContactMatch(user1, user2).data.matches[0]).to.be.oneOf(user2ContactsHashedMatching)
  expect(getContactMatch(user2, user1).data.matches[0]).to.be.oneOf(user2ContactsHashedMatching)
  expect(getContactMatch(user2, user1).data.onlyOneMatch).to.be.true

})




const creds = testUtil.credData

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let pushTokens

const requestAndExpect = (thisRequest, tokenIndex, result) => {
  return thisRequest
    .set('Authorization', 'Bearer ' + pushTokens[tokenIndex])
    .expect('Content-Type', /json/)
    .then(r => {
      expect(r.body).to.deep.equal(result)
      expect(r.status).that.equals(200)
    })
    .catch(err => Promise.reject(err))
}

const getAndExpect = (endpoint, tokenIndex, result) => {
  return requestAndExpect(request(Server).get(endpoint), tokenIndex, result)
}

const deleteAndExpect = (endpoint, tokenIndex, result) => {
  return requestAndExpect(request(Server).delete(endpoint), tokenIndex, result)
}




before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})




describe('7 - Selected Contact Correlation', () => {

  it('anonymous request fails', async () => {
    return request(Server)
      .get(
        '/api/userUtil/getContactMatch?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(401)
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 gets no results', async () => {
    return request(Server)
      .get(
        '/api/userUtil/getContactMatch?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: RESULT_NEED_BOTH_USER_DATA })
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 sends contact hashes', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      }).catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 still gets no results', async () => {
    return request(Server)
      .get(
        '/api/userUtil/getContactMatch?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 sends no contact hashes', async () => {
    const basicJwt = R.clone(testUtil.jwtTemplate)
    basicJwt.iss = creds[2].did
    const basicJwtEnc = await credentials[2].createVerification(basicJwt)

    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + basicJwtEnc)
      .send({ contactHashes: [] })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 gets no match', async () => {
    return request(Server)
      .get(
        '/api/userUtil/getContactMatch?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 asks to clear caches for round 2', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[2].did)
    return deleteAndExpect(endpoint, 1, {success: RESULT_NEED_APPROVAL})
  }).timeout(3000)

  it('user 2 asks to clear caches for round 2', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[1].did)
    return deleteAndExpect(endpoint, 2, {success: RESULT_ALL_CLEARED})
  }).timeout(3000)

  it('user 2 sends some non-matching contact hashes', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts1Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 sends contact hashes for totally different user', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[4].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 still gets undefined match with user 2', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: RESULT_NEED_THIS_USER_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 sends contact hashes for user 2', async () => {
    return request(Server)
      .post(
          '/api/userUtil/cacheContactList?counterparty='
          + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 gets no match again', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 asks to clear caches for round 3', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[2].did)
    return deleteAndExpect(endpoint, 1, {success: RESULT_NEED_APPROVAL})
  }).timeout(3000)

  it('user 2 asks to clear caches for round 3', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[1].did)
    return deleteAndExpect(endpoint, 2, {success: RESULT_ALL_CLEARED})
  }).timeout(3000)

  it('user 1 sends contact hashes one more time', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 sends contact hashes one more time', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts2Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: {matches: [matchingContactDid]}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 gets a match', async () => {
    const sql = '/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did)
    return getAndExpect(sql, 1, { data: {matches: [matchingContactDid]}})
  }).timeout(3000)

  it('user 2 gets a match', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: {matches: [matchingContactDid]}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 still gets a match', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: {matches: [matchingContactDid]}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 asks to clear caches for round 4', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[1].did)
    return deleteAndExpect(endpoint, 2, {success: RESULT_NEED_APPROVAL})
  }).timeout(3000)

  it('user 1 still gets old match (until cache clears)', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: {matches: [matchingContactDid]}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 still gets old match (until cache clears)', async () => {
    return request(Server)
      .get('/api/userUtil/getContactMatch?counterparty=' + encodeURIComponent(creds[1].did))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.deep.equal({data: {matches: [matchingContactDid]}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 asks to clear caches for round 5 (and gets it because user 2 asked earlier)', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[2].did)
    return deleteAndExpect(endpoint, 1, {success: RESULT_ALL_CLEARED})
  }).timeout(3000)

  it('user 1 sends contact hashes for multiple matches', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty=' + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user2Contacts1Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 sends contact hashes for multiple matches', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty=' + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts2Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: {matches: user2ContactsHashedMatching}})
        expect(r.body.data.onlyOneMatch).to.be.undefined
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 1 asks to clear caches for round 6', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[2].did)
    return deleteAndExpect(endpoint, 1, {success: RESULT_NEED_APPROVAL})
  }).timeout(3000)

  it('user 2 asks to clear caches for round 6', async () => {
    const endpoint = '/api/userUtil/clearContactCaches?counterparty=' + encodeURIComponent(creds[1].did)
    return deleteAndExpect(endpoint, 2, {success: RESULT_ALL_CLEARED})
  }).timeout(3000)

  it('user 1 sends contact hashes for multiple matches but only wants 1 match', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user2Contacts1Hashed, onlyOneMatch: true })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.deep.equal({data: RESULT_NEED_COUNTERPARTY_DATA})
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

  it('user 2 sends contact hashes for multiple matches', async () => {
    return request(Server)
      .post(
        '/api/userUtil/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts2Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body.data.matches).to.have.lengthOf(1)
        expect(r.body.data.matches[0]).to.be.oneOf(user2ContactsHashedMatching)
        expect(r.body.data.onlyOneMatch).to.be.true
      })
      .catch(err => Promise.reject(err))
  }).timeout(3000)

})

describe('7 - Get Confirming IDs for Claims', () => {

  const newGive = R.clone(testUtil.claimGive)
  delete newGive.fulfills // remove unused field
  newGive.agent = { identifier: creds[0].did }
  newGive.description = 'Got to sleep over without much trouble'
  newGive.recipient = { identifier: creds[2].did }

  let firstGiveRecordJwtId, secondRecordJwtId

  it('insert a give for later confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(newGive)
    credObj.sub = creds[0].did
    credObj.iss = creds[0].did
    const claimJwtEnc = await credentials[0].createVerification(credObj)

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
        firstGiveRecordJwtId = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 0 confirmers back', async () => {

    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(0)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add a confirmation by someone else', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: firstGiveRecordJwtId
    }
    credObj.sub = creds[0].did
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
        expect(r.body.success.confirmations[0])
          .does.not.have.property("embeddedRecordError")
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 1 confirmer back but cannot see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(1)
        expect(r.body.data[0]).to.equal(HIDDEN_TEXT)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 1 confirmer back and can see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(1)
        expect(r.body.data[0]).to.equal(creds[1].did)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('fail to add a duplicate confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: firstGiveRecordJwtId
    }
    credObj.sub = creds[0].did
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
        expect(r.body.success.confirmations[0])
          .has.property("embeddedRecordError")
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 1 confirmer back and can see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(1)
        expect(r.body.data[0]).to.equal(creds[1].did)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add another confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: firstGiveRecordJwtId
    }
    credObj.sub = creds[0].did
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
        expect(r.body.success.confirmations[0])
          .does.not.have.property("embeddedRecordError")
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 2 confirmers back and can see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(2)
        expect(r.body.data[0]).to.equal(creds[1].did)
        expect(r.body.data[1]).to.equal(creds[2].did)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add yet another confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: firstGiveRecordJwtId
    }
    credObj.sub = creds[0].did
    credObj.iss = creds[5].did
    const claimJwtEnc = await credentials[5].createVerification(credObj)

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
        expect(r.body.success.confirmations[0])
            .does.not.have.property("embeddedRecordError")
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 3 confirmers back and can see some', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
          .to.be.an('array')
          .of.length(3)
        expect(r.body.data[0]).to.equal(creds[1].did)
        expect(r.body.data[1]).to.equal(creds[2].did)
        expect(r.body.data[2]).to.equal(HIDDEN_TEXT)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  /**
   * Haven't written the logic for this... and it may never be necessary.
   * In fact, it may not be desirable: events and land locations and roles are
   * easy to make unique, but to algorithmically determine the right give
   * record you'll have to compare many inputs. May be OK if only one found.
   *

  it('add a confirmation on content (not handleId)', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = R.clone(newGive)
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
  }).timeout(3000)

  it('get 2 confirmers back and can see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        console.log('confirmers', r.body)
        expect(r.body.data)
            .to.be.an('array')
            .of.length(2)
        expect(r.body.data[0]).to.equal(creds[1].did)
        expect(r.body.data[1]).to.equal(creds[2].did)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  *
  **/

  it('get 3 confirmers back and can see some', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
          .to.be.an('array')
          .of.length(3)
        expect(r.body.data[0]).to.equal(creds[1].did)
        expect(r.body.data[1]).to.equal(creds[2].did)
        expect(r.body.data[2]).to.equal(HIDDEN_TEXT)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add some other random claim', async () => {
    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimPerson)
    credObj.claim.identifier = creds[3].did
    credObj.claim.description = "Gave a gift with kudos, publicly"
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
        secondRecordJwtId = r.body.success.claimId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add a confirmation of that other random claim', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: secondRecordJwtId
    }
    credObj.sub = creds[3].did
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
        expect(r.body.success.confirmations[0])
            .does.not.have.property("embeddedRecordError")
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('add a confirmation of that other random claim by someone from first claim', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      lastClaimId: secondRecordJwtId
    }
    credObj.sub = creds[3].did
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
          expect(r.body.success.confirmations[0])
              .does.not.have.property("embeddedRecordError")
          expect(r.status).that.equals(201)
        }).catch((err) => {
          return Promise.reject(err)
        })
  }).timeout(3000)

  it('get 4 confirmers back and can see some', async () => {
    return request(Server)
      .post('/api/v2/report/confirmers')
      .send({ claimEntryIds: [ firstGiveRecordJwtId, secondRecordJwtId ] })
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .then(r => {
        if (r.body.error) {
          console.log('Something went wrong. Here is the response body: ', r.body)
          return Promise.reject(r.body.error)
        }
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(200)
        expect(r.body.data)
          .to.be.an('array')
          .of.length(4)
        expect(r.body.data[0]).to.equal(creds[1].did)
        expect(r.body.data[1]).to.equal(creds[2].did)
        expect(r.body.data[2]).to.equal(HIDDEN_TEXT)
        expect(r.body.data[3]).to.equal(creds[4].did)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})

describe('7 - Add Sample Pledge', () => {

  it('user 0 accepts a pledge', async () => {
    const pledgeObj = R.clone(testUtil.jwtTemplate)
    pledgeObj.claim = {
      "@context": "https://schema.org",
      "@type": "AcceptAction",
      "agent": { identifier: creds[0].did },
      "object": "I am building a giving society, in ways that fulfill me.",
    }
    pledgeObj.iss = creds[0].did
    const planJwtEnc = await credentials[1].createVerification(pledgeObj)
    return request(Server)
      .post('/api/v2/claim')
      .send({jwtEncoded: planJwtEnc})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

})
