import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
const crypto = require('crypto')
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import { getContactMatch, cacheContactList } from "../server/api/services/contact-correlation.service"
import Server from '../server'
import testUtil from './util'

const expect = chai.expect

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

it('contact lists can match', () => {
  const user1 = 'did:test:abc'
  const user2 = 'did:test:def'
  const user3 = 'did:test:xyz'

  expect(getContactMatch(user1, user2)).to.be.undefined

  // non-match for empty list
  expect(cacheContactList(user1, user2, [])).to.be.undefined
  expect(getContactMatch(user1, user2)).to.be.undefined
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.be.null
  expect(getContactMatch(user1, user2)).to.be.null
  expect(getContactMatch(user2, user1)).to.be.null
  expect(getContactMatch(user1, user3)).to.be.undefined

  // non-match for lack of matches
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.be.undefined
  expect(getContactMatch(user1, user2)).to.be.null
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.be.null
  expect(getContactMatch(user1, user2)).to.be.null
  expect(getContactMatch(user2, user1)).to.be.null

  // non-match w/ bad password
  expect(getContactMatch(user1, user2)).to.be.null
  expect(cacheContactList(user2, user1, user2Contacts3Hashed)).to.be.undefined
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.be.null
  expect(getContactMatch(user1, user2)).to.be.null
  expect(getContactMatch(user2, user1)).to.be.null

  // now get match
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.be.undefined
  expect(getContactMatch(user1, user2)).to.be.null
  expect(cacheContactList(user2, user1, user2Contacts2Hashed)).to.equal(matchingContactDid)
  expect(getContactMatch(user1, user2)).to.equal(matchingContactDid)
  expect(getContactMatch(user2, user1)).to.equal(matchingContactDid)

  // user 1 still gets match if user2 removes match immediately
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.be.undefined
  expect(getContactMatch(user1, user2)).to.equal(matchingContactDid)
  expect(getContactMatch(user2, user1)).to.equal(matchingContactDid)
  expect(cacheContactList(user2, user1, [])).to.be.undefined
  expect(getContactMatch(user1, user2)).to.equal(matchingContactDid)
  expect(getContactMatch(user2, user1)).to.equal(matchingContactDid)

  // both get no matches if they remove
  expect(cacheContactList(user1, user2, [])).to.be.null
  expect(getContactMatch(user1, user2)).to.be.null
  expect(getContactMatch(user2, user1)).to.be.null
})




const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

let pushTokens

before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})

describe('7 - Selected Contact Correlation', () => {

  it('user 1 gets no results', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[1].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.equal('')
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 sends contact hashes', async () => {
    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal('')
      }).catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 still gets no results', async () => {
    return request(Server)
        .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[1].did))
        .set('Authorization', 'Bearer ' + pushTokens[1])
        .expect('Content-Type', /json/)
        .then(r => {
          expect(r.status).that.equals(200)
          expect(r.body).to.equal('')
        })
        .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 sends no contact hashes', async () => {
    const basicJwt = R.clone(testUtil.jwtTemplate)
    basicJwt.iss = creds[2].did
    const basicJwtEnc = await credentials[2].createVerification(basicJwt)

    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + basicJwtEnc)
      .send({ contactHashes: [] })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.be.null
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 gets null match', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.null
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 sends some non-matching contact hashes', async () => {
    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts1Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal('')
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 sends contact hashes for totally different user', async () => {
    return request(Server)
      .post(
          '/api/util/cacheContactList?counterparty='
          + encodeURIComponent(creds[4].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal('')
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 still gets undefined match with user 2', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.null
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 sends contact hashes for user 2', async () => {
    return request(Server)
      .post(
          '/api/util/cacheContactList?counterparty='
          + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.be.null
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 gets no match again', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.null
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 sends contact hashes one more time', async () => {
    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[2].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ contactHashes: user1ContactsHashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal('')
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 sends contact hashes one more time', async () => {
    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: user2Contacts2Hashed })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 gets a match', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).to.equal(200)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 gets a match', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 still gets a match', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 clears out contact hashes', async () => {
    return request(Server)
      .post(
        '/api/util/cacheContactList?counterparty='
        + encodeURIComponent(creds[1].did)
      )
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({ contactHashes: [] })
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(201)
        expect(r.body).to.equal('')
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 still gets old match (until cache clears)', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[2].did))
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 2 still gets old match (until cache clears)', async () => {
    return request(Server)
      .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[1].did))
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.equal(matchingContactDid)
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

})
