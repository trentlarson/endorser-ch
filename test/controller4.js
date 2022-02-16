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
  "@context": "http://schema.org",
  "@type": "Offer",
  identifier: "abc",
  issuedAt: '2022-02-15 19:28:00Z',
  itemOffered: { amountOfThisGood: 2, unitCode: 'HUR' },
  offeredBy: { identifier: creds[0].did },
}

const claimOffer_By0_JwtObj = R.clone(testUtil.jwtTemplate)
claimOffer_By0_JwtObj.claim = R.clone(claimOffer)
const claimOffer_By0_JwtProm = credentials[0].createVerification(claimOffer_By0_JwtObj)

const manyClaims = R.times(() => credentials[0].createVerification(claimOffer_By0_JwtObj), 101)

let pushTokens, manyClaimsJwtEnc

before(async () => {

  await Promise.all(pushTokenProms)
    .then((jwts) => {
      pushTokens = jwts;
      console.log("Created controller push tokens", pushTokens)
    })

  await Promise.all(manyClaims)
    .then((jwts) => {
      manyClaimsJwtEnc = jwts
      console.log("Created controller4 user tokens", jwts)
    })

})

let moreAfter

describe('Load Claims Incrementally', () => {

  it('insert offer claim', () => {
    return request(Server)
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
  })

  it('retrieve single claim with no more after', () => {
    return request(Server)
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
  })

  it('insert many, many claims claim', () => {
    return Promise.all(
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
  })

  it('retrieve many claims with many more to come', () => {
    return request(Server)
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
  })

  it('retrieve many claims with a few more to come', () => {
    return request(Server)
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
  })


  it('retrieve many claims with a few more to come', () => {
    return request(Server)
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
  })

})
