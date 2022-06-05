import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import request from 'supertest'
import { DateTime } from 'luxon'
import R from 'ramda'
const { Credentials } = require('uport-credentials')

import Server from '../server'
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
const claimOffer_By0_JwtProm = credentials[0].createVerification(claimOffer_By0_JwtObj)

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
      testUtil.jwtTemplate
    ),
    101
  )
const manyClaimsJwts = manyClaims.map(claim => credentials[0].createVerification(claim))

let pushTokens, manyClaimsJwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      console.log("Created controller4 push tokens", pushTokens)
    })

  await Promise.all(manyClaimsJwts)
    .then((jwts) => {
      manyClaimsJwtEnc = jwts
      console.log("Created controller4 user tokens", jwts)
    })

  return Promise.resolve()
})

let moreAfter

describe('Load Claims Incrementally', () => {

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
  )

  it('retrieve single Give/Offer claim with no more after', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])))
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body).that.does.not.have.property('maybeMoreAfter')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  it('insert many, many claims', () =>
    Promise.all(
      manyClaimsJwtEnc.map((jwtEnc) => {
        return request(Server)
          .post('/api/claim')
          .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
          .send({jwtEncoded: jwtEnc})
          .expect('Content-Type', /json/)
          .then(r => {
            expect(r.body).to.be.a('string')
            expect(r.status).that.equals(201)
          }).catch((err) => {
            return Promise.reject(err)
          })
      })
    )
  ).timeout(6001)

  it('retrieve many Give/Offer claims with many more to come', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])))
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(50)
        expect(r.body).that.has.a.property('maybeMoreAfter')
        expect(r.body.maybeMoreAfter).to.be.a('string')
        moreAfter = r.body.maybeMoreAfter
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  it('retrieve many Give/Offer claims with a few more to come', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])) + '&afterId=' + moreAfter)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(50)
        expect(r.body).that.has.a.property('maybeMoreAfter')
        moreAfter = r.body.maybeMoreAfter
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  )


  it('retrieve a few more Give/Offer claims', () =>
    request(Server)
      .get('/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])) + '&afterId=' + moreAfter)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(2)
        expect(r.body).that.does.not.have.property('maybeMoreAfter')
        expect(r.status).that.equals(200)
      }).catch((err) => {
        return Promise.reject(err)
      })
  )




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
        expect(r.body.data).to.be.an('array').of.length(50)
        expect(r.body).that.has.a.property('maybeMoreAfter')
        expect(r.body.maybeMoreAfter).to.be.a('string')
        moreAfter = r.body.maybeMoreAfter
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  it('retrieve all claims with a few more to come', () =>
    request(Server)
      .get('/api/reportAll/claims?afterId=' + moreAfter)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(50)
        expect(r.body).that.has.a.property('maybeMoreAfter')
        moreAfter = r.body.maybeMoreAfter
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

  it('retrieve a few more claims', () =>
    request(Server)
      .get('/api/reportAll/claims?afterId=' + moreAfter)
      .set(UPORT_PUSH_TOKEN_HEADER, pushTokens[0])
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.status).that.equals(200)
        expect(r.body).to.be.an('object')
        expect(r.body).that.has.a.property('data')
        expect(r.body.data).to.be.an('array').of.length(40)
        expect(r.body).that.does.not.have.property('maybeMoreAfter')
      }).catch((err) => {
        return Promise.reject(err)
      })
  )

})
