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
const inviteIdentifier =
  Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2);

const registerUnknownBy0Obj = R.clone(testUtil.jwtTemplate)
registerUnknownBy0Obj.claim = R.clone(testUtil.registrationTemplate)
registerUnknownBy0Obj.claim.agent.identifier = creds[0].did
delete registerUnknownBy0Obj.claim.participant
registerUnknownBy0Obj.claim.identifier = inviteIdentifier

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

  let registerUnknownBy0Enc
  it('unregistered user cannot create an invite', async () => {
    // ensure the user is not registered
    await new Promise((resolve, reject) => request(Server)
      .get('/api/report/rateLimits')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
        resolve(r.body)
      })
      .catch(err => reject(err))
    )
    registerUnknownBy0Enc = await credentials[13].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .send({ inviteJwt: registerUnknownBy0Enc, notes: inviteNotes })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err));
  })

  it('user cannot sent a non-register claim for an invite, or a claim for another user', async () => {
    const someGiveBy4Obj = R.clone(someGiveBy5Obj)
    someGiveBy4Obj.claim.agent = {identifier: creds[4].did}
    const someGiveBy4JwtEnc = await credentials[4].createVerification(someGiveBy4Obj)
    return request(Server)
    .post('/api/userUtil/invite')
    .set('Authorization', 'Bearer ' + pushTokens[4])
    .send({inviteJwt: someGiveBy4JwtEnc, notes: inviteNotes})
    .then(r => {
      expect(r.body).to.have.property("error")
      expect(r.headers['content-type'], /json/)
      expect(r.status).that.equals(400)
    })
    .catch(err => Promise.reject(err));
  })

  it('user cannot sent a register claim for another user', async () => {
    registerUnknownBy0Enc = await credentials[0].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .send({ inviteJwt: registerUnknownBy0Enc, notes: inviteNotes })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err));
  })

  it('registered user can create an invite record', async () => {
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
      .get('/api/userUtil/invite/' + inviteIdentifier)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.have.property("inviteIdentifier", inviteIdentifier)
        expect(r.body.data).to.have.property("notes")
        expect(r.body.data).to.have.property("expiresAt")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user can retrieve all their invite records', () => {
    return request(Server)
      .get('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array').of.length(1)
        expect(r.body.data[0]).to.have.property("inviteIdentifier", inviteIdentifier)
        expect(r.body.data[0]).to.have.property("notes")
        expect(r.body.data[0]).to.have.property("expiresAt")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  it('user #13 cannot make a claim', async () => {
    const someGiveBy5JwtEnc = await credentials[13].createVerification(someGiveBy5Obj)
    return request(Server)
    .post('/api/v2/claim')
    .send({ jwtEncoded: someGiveBy5JwtEnc })
    .then(r => {
      expect(r.body).to.have.property("error")
      expect(r.headers['content-type']).to.match(/json/)
      expect(r.status).that.equals(400)
    })
    .catch(err => Promise.reject(err))
  });

  it('user #13 can sign up from the registration', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
      .post('/api/v2/claim')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .send({ jwtEncoded: registerUnknownBy0Enc })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  });

  it('user #13 can now make a claim', async () => {
    const someGiveBy5JwtEnc = await credentials[13].createVerification(someGiveBy5Obj)
    return request(Server)
      .post('/api/v2/claim')
      .send({ jwtEncoded: someGiveBy5JwtEnc })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  });

  it('other registered user cannot retrieve an invite record by someone else', () => {
    return request(Server)
      .get('/api/userUtil/invite/' + inviteIdentifier)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

});
