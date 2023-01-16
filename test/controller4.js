
// Tests to Load Claims Incrementally

import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'
const { Credentials } = require('uport-credentials')

import Server from '../server'
import dbService from '../server/api/services/endorser.db.service'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import testUtil from './util'

const expect = chai.expect

const creds = testUtil.creds

const credentials = R.map((c) => new Credentials(c), creds)

const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.tomorrowEpoch }), credentials)

const claimOffer = {
  "@context": "https://schema.org",
  "@type": "Offer",
  identifier: "abc",
  issuedAt: '2022-02-15 19:28:00Z',
  itemOffered: { amountOfThisGood: 2, unitCode: 'HUR' },
  offeredBy: { identifier: creds[0].did },
  recipient: { identifier: creds[1].did },
}

const claimOffer_By0_JwtObj = R.clone(testUtil.jwtTemplate)
claimOffer_By0_JwtObj.claim = R.clone(claimOffer)
claimOffer_By0_JwtObj.sub = creds[1].did

const manyClaims =
  R.times(n =>
    R.set(
      R.lensProp('claim'),
      R.set(
        R.lensProp('identifier'),
        'abcxyz' + String(n),
        R.set(
          R.lensProp('issuedAt'),
          new Date().toISOString(),
          claimOffer
        )
      ),
      claimOffer_By0_JwtObj
    ),
    101
  )
const manyClaimsJwts = manyClaims.map(claim => credentials[0].createVerification(claim)) // adds iss & exp

let pushTokens, manyClaimsJwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      //console.log("Created controller4 push tokens", pushTokens)
    })

  await Promise.all(manyClaimsJwts)
    .then((jwts) => {
      manyClaimsJwtEnc = jwts
      //console.log("Created controller4 user tokens", jwts)
    })

  return Promise.resolve()
})

const RESULT_COUNT_LIMIT = 50, TOTAL_CLAIMS = 152, NTH_IN_SECOND_BATCH = 7
let moreBeforeId, firstInList, startOfSecondBatchInList, nthInListInSecondBatch

describe('4 - Load Claims Incrementally', () => {

  it('insert offer claim', () =>
    request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .send({jwtEncoded: manyClaimsJwtEnc[0]})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.a('string')
        expect(r.status).that.equals(201)
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(5000)

  it('retrieve single Give/Offer claim with no more after', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])))
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body).that.does.not.have.property('hitLimit')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('insert many, many claims', async () => {
    await dbService.registrationUpdateMaxClaims(creds[0].did, 124)

    return Promise.all(
      manyClaimsJwtEnc.map((jwtEnc) => {
        return request(Server)
          .post('/api/claim')
          .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
          .send({jwtEncoded: jwtEnc})
          .then(r => {
            if (r.body.error) {
              console.log('Something went wrong. Here is the response body: ', r.body)
              return Promise.reject(r.body.error)
            }
            expect(r.headers['content-type'], /json/)
            expect(r.body).to.be.a('string')
            expect(r.status).that.equals(201)
          }).catch((err) => {
            return Promise.reject(err)
          })
      })
    )
  }).timeout(9000)

  it('retrieve many Give/Offer claims with many more to come', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])))
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        moreBeforeId = r.body.data[r.body.data.length - 1].id
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve many Give/Offer claims with a few more to come', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])) + '&beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        moreBeforeId = r.body.data[r.body.data.length - 1].id
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve a few more Give/Offer claims', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])) + '&beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body).that.does.not.have.property('hitLimit')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  //---------------- Now do the same with full JWT retrieval.

  it('retrieve all claims with many more to come', () =>
    request(Server)
      .get('/api/reportAll/claims')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        expect(r.body.data[0].id > r.body.data[1].id).to.be.true // descending order
        firstInList = r.body.data[0]
        moreBeforeId = r.body.data[r.body.data.length - 1].id
        startOfSecondBatchInList = moreBeforeId
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve all claims with a few more to come', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        moreBeforeId = r.body.data[r.body.data.length - 1].id
        nthInListInSecondBatch = r.body.data[NTH_IN_SECOND_BATCH - 1]
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve a few more claims', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(50)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        moreBeforeId = r.body.data[r.body.data.length - 1].id
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve a very few more claims', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body).that.does.not.have.property('hitLimit')
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  //---------------- Now do the same reverse chronologically, with a subset.

  it('retrieve some earlier claims, reverse chronologically', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + nthInListInSecondBatch.id)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body.hitLimit).to.be.a('boolean')
        expect(r.body.hitLimit).to.be.true
        moreBeforeId = r.body.data[r.body.data.length - 1].id
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  it('retrieve rest of the earlier claims, reverse chronologically', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + moreBeforeId)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        let expectedCount =
            TOTAL_CLAIMS - (RESULT_COUNT_LIMIT + NTH_IN_SECOND_BATCH + RESULT_COUNT_LIMIT)
        expect(r.body.data).to.be.an('array').of.length(expectedCount)
        expect(r.body).that.does.not.have.property('hitLimit')
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  //---------------- Now use "before" with a maximum ID.

  it('retrieve items at end with a maximum "beforeId" value', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=7ZZZZZZZZZZZZZZZZZZZZZZZZZ')
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        expect(r.body).that.does.have.property('hitLimit')
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  //---------------- Now do subset with both before & after params.

  it('retrieve small set of items via after & before', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + startOfSecondBatchInList + '&afterId=' + nthInListInSecondBatch.id)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(NTH_IN_SECOND_BATCH - 1)
        expect(r.body).that.does.not.have.property('hitLimit')
      }).catch((err) => {
        return Promise.reject(err)
      })
  ).timeout(3000)

  //---------------- Now do subset with both before & after params, more than the limit.

  it('retrieve bigger set of items via after & before', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + firstInList.id + '&afterId=' + nthInListInSecondBatch.id)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(RESULT_COUNT_LIMIT)
        moreBeforeId = r.body.data[r.body.data.length - 1].id
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  it('retrieve rest of items via after & before', () =>
    request(Server)
      .get('/api/reportAll/claims?beforeId=' + moreBeforeId + '&afterId=' + nthInListInSecondBatch.id)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(NTH_IN_SECOND_BATCH - 2) // because we excluded firstInList.id to get to moreBeforeId
        expect(r.body).that.does.not.have.property('hitLimit')
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

})
