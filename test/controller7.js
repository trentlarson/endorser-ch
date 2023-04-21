import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
const crypto = require('crypto')
import R from 'ramda'
import request from 'supertest'
const { Credentials } = require('uport-credentials')

import { cacheContactList, getContactMatch, RESULT_NEED_DATA, RESULT_NO_MATCH }
  from "../server/api/services/contact-correlation.service"
import Server from '../server'
import { HIDDEN_TEXT } from '../server/api/services/util';
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

  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_DATA})

  // non-match for empty list
  expect(cacheContactList(user1, user2, [])).to.deep.equal({data: RESULT_NEED_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NEED_DATA})
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user3)).to.deep.equal({data: RESULT_NEED_DATA})

  // non-match for lack of matches
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NEED_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})

  // non-match w/ bad password
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(cacheContactList(user2, user1, user2Contacts3Hashed)).to.deep.equal({data: RESULT_NEED_DATA})
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})

  // now get match
  expect(cacheContactList(user1, user2, user1ContactsHashed)).to.deep.equal({data: RESULT_NEED_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(cacheContactList(user2, user1, user2Contacts2Hashed)).to.deep.equal({data: {match: matchingContactDid} })
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {match: matchingContactDid} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {match: matchingContactDid} })

  // user 1 still gets match if user2 removes match immediately
  expect(cacheContactList(user2, user1, user2Contacts1Hashed)).to.deep.equal({data: RESULT_NEED_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {match: matchingContactDid} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {match: matchingContactDid} })
  expect(cacheContactList(user2, user1, [])).to.deep.equal({data: RESULT_NEED_DATA})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: {match: matchingContactDid} })
  expect(getContactMatch(user2, user1)).to.deep.equal({data: {match: matchingContactDid} })

  // both get no matches if they remove
  expect(cacheContactList(user1, user2, [])).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user1, user2)).to.deep.equal({data: RESULT_NO_MATCH})
  expect(getContactMatch(user2, user1)).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA })
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
      }).catch(err => Promise.reject(err))
  }).timeout(5000)

  it('user 1 still gets no results', async () => {
    return request(Server)
        .get('/api/util/getContactMatch?counterparty=' + encodeURIComponent(creds[1].did))
        .set('Authorization', 'Bearer ' + pushTokens[1])
        .expect('Content-Type', /json/)
        .then(r => {
          expect(r.status).that.equals(200)
          expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
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
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
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
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NO_MATCH})
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
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
        expect(r.body).to.deep.equal({data: RESULT_NEED_DATA})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
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
        expect(r.body).to.deep.equal({data: {match: matchingContactDid}})
      })
      .catch(err => Promise.reject(err))
  }).timeout(5000)

})

describe('7 - Get Confirming IDs for Claims', () => {

  let firstGiveRecordJwtId

  it('insert a give for later confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.claimGive)
    credObj.claim.fulfills = undefined // remove unused field
    credObj.claim.description = 'Got to sleep over without much trouble'
    credObj.claim.recipient = { identifier: creds[2].did }
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
        firstGiveRecordJwtId = r.body.success.jwtId
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 0 confirmers back', async () => {

    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimJwtIds: [ firstGiveRecordJwtId ] })
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
      jwtId: firstGiveRecordJwtId
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
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 1 confirmer back but cannot see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimJwtIds: [ firstGiveRecordJwtId ] })
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
      .send({ claimJwtIds: [ firstGiveRecordJwtId ] })
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

  it('try to add a duplicate confirmation', async () => {

    const credObj = R.clone(testUtil.jwtTemplate)
    credObj.claim = R.clone(testUtil.confirmationTemplate)
    credObj.claim.object = {
      jwtId: firstGiveRecordJwtId
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
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  }).timeout(3000)

  it('get 1 confirmer back and can see them', async () => {
    return request(Server)
      .get('/api/v2/report/confirmers')
      .send({ claimJwtIds: [ firstGiveRecordJwtId ] })
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

  // add confirm by same person

  // check for 1 confirmation

  // check for a confirmation when confirmed with content (not handleId)?

  // check for confirmations on mutliple claims

  // Do I really want to send the IDs in a GET body?
})

describe('7 - Add Sample Pledge', () => {

  it('user 0 accepts a pledge', async () => {
    const planObj = R.clone(testUtil.jwtTemplate)
    planObj.claim = {
      "@context": "https://schema.org",
      "@type": "AcceptAction",
      "agent": { identifier: creds[0].did },
      "object": "I am building a society based on giving, in ways that fulfill me.",
    }
    planObj.iss = creds[0].did
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

})
