import request from "supertest";

import Server from "../dist";
import testUtil from "./util";
import R from "ramda";
import {Credentials} from "uport-credentials";
import chai from "chai";
import EndorserDatabase from "../src/api/services/endorser.db.service";

const expect = chai.expect

const creds = testUtil.ethrCredData
const credentials = R.map((c) => new Credentials(c), creds)
const pushTokenProms = R.map((c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }), credentials)
let pushTokens
before(async () => {
  await Promise.all(pushTokenProms).then(jwts => { pushTokens = jwts })
  return Promise.resolve()
})

// create the identifier out of random characters (at least 20 characters)
const identifier =
  Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2);

const registerUnknownBy0Obj = R.clone(testUtil.jwtTemplate)
registerUnknownBy0Obj.claim = R.clone(testUtil.registrationTemplate)
registerUnknownBy0Obj.claim.agent.identifier = creds[0].did
delete registerUnknownBy0Obj.participant
registerUnknownBy0Obj.claim.identifier = identifier

const someGiveBy5Obj = R.clone(testUtil.jwtTemplate)
someGiveBy5Obj.claim = R.clone(testUtil.claimGive)
someGiveBy5Obj.claim.agent = { identifier: creds[5].did }
someGiveBy5Obj.claim.recipient = { identifier: creds[0].did }
someGiveBy5Obj.claim.description = "Fixing the screen door."
someGiveBy5Obj.claim.object = {
  '@type': 'TypeAndQuantityNode',
  amountOfThisGood: .5,
  unitCode: 'HUR',
}
delete someGiveBy5Obj.claim.fulfills

describe('8 - Asynchronous Invitations', () => {

  const inviteNotes = "Invitation for neighbor #5";

  it('unregistered user cannot create an invite', async () => {
    return request(Server)
    .post('/api/userUtil/invite')
    .set('Authorization', 'Bearer ' + pushTokens[5])
    .send({ inviteJwt: registerUnknownBy0Enc, notes: inviteNotes })
    .then(r => {
      expect(r.headers['content-type'], /json/)
      expect(r.status).that.equals(400)
      expect(r.body).to.have.property("error")
    })
    .catch(err => Promise.reject(err));
  })

  let registerUnknownBy0Enc
  it('registered user can create an invite record', async () => {
    // generate an expiration date for next week
    const expiresAt = new Date(Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60 * 1000)).toISOString();
    registerUnknownBy0Enc = await credentials[0].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ inviteJwt: registerUnknownBy0Enc, notes: inviteNotes })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user can retrieve an invite record', () => {
    return request(Server)
      .get('/api/userUtil/invite/' + identifier)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.body.data).to.have.property("inviteIdentifier", identifier)
        expect(r.body.data).to.have.property("notes")
        expect(r.body.data).to.have.property("expiresAt")
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  it('user #5 can sign up from the registration', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
      .post('/api/v2/claim')
      .set('Authorization', 'Bearer ' + pushTokens[5])
      .send({ jwtEncoded: registerUnknownBy0Enc })
      .then(r => {
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.body).to.have.property("success")
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  });

  it('user #5 can now make a claim', async () => {
    const someGiveBy5JwtEnc = await credentials[5].createVerification(someGiveBy5Obj)
    return request(Server)
      .post('/api/v2/claim')
      .send({ jwtEncoded: someGiveBy5JwtEnc })
      .then(r => {
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.body).to.have.property("success")
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  });

  it('other registered user cannot retrieve an invite record', () => {
    return request(Server)
      .get('/api/userUtil/invite/' + identifier)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.body).to.have.property("error")
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

});
