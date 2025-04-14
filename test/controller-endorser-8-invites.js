
import chai from "chai";
import { DateTime } from "luxon";
import R from "ramda";
import request from "supertest";
import { Credentials } from "uport-credentials";

import Server from "../dist";
import testUtil from "./util";
import {dbService} from "../dist/api/services/endorser.db.service";

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
const inviteIdentifier1 =
  Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2)
  + Math.random().toString(36).substring(2);

const registerUnknownBy0Obj = R.clone(testUtil.jwtTemplate)
registerUnknownBy0Obj.claim = R.clone(testUtil.registrationTemplate)
registerUnknownBy0Obj.claim.agent.identifier = creds[0].did
delete registerUnknownBy0Obj.claim.participant
registerUnknownBy0Obj.claim.identifier = inviteIdentifier1

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

  let registerUnknownBy0Enc1
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
    registerUnknownBy0Enc1 = await credentials[13].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .send({ inviteJwt: registerUnknownBy0Enc1, notes: inviteNotes })
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

  it('user cannot send a register claim for another user', async () => {
    registerUnknownBy0Enc1 = await credentials[0].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[4])
      .send({ inviteJwt: registerUnknownBy0Enc1, notes: inviteNotes })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type'], /json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err));
  })

  it('registered user #0 can create an invite record', async () => {
    registerUnknownBy0Enc1 = await credentials[0].createVerification(registerUnknownBy0Obj)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ inviteJwt: registerUnknownBy0Enc1, notes: inviteNotes })
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body).to.have.property("success", true)
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(201)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user #0 cannot send the same invite record', async () => {
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ inviteJwt: registerUnknownBy0Enc1, notes: "Bad token" })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user #0 can retrieve an invite record', () => {
    return request(Server)
      .get('/api/userUtil/invite/' + inviteIdentifier1)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.have.property("inviteIdentifier", inviteIdentifier1)
        expect(r.body.data).to.have.property("notes")
        expect(r.body.data).to.have.property("expiresAt")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  const EXPECTED_LIMIT = 18
  let inviteIdentifier2, inviteIdentifier3
  it('registered user #0 can create many invite records', async () => {
    // create more invite records to get to the limit
    for (let i = 0; i < EXPECTED_LIMIT - 1; i++) {
        const inviteIdentifierTemp =
          Math.random().toString(36).substring(2)
          + Math.random().toString(36).substring(2)
          + Math.random().toString(36).substring(2);
        if (i === 0) {
          inviteIdentifier2 = inviteIdentifierTemp
        } else if (i === 1) {
          inviteIdentifier3 = inviteIdentifierTemp
        }
        // exclude the invite JWT for the rest of these
        await
          request(Server)
            .post('/api/userUtil/invite')
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .send({ inviteIdentifier: inviteIdentifierTemp, notes: inviteNotes, expiresAt: testUtil.nextDayEpoch })
            .then(r => {
              if (r.body.error) {
                throw new Error(JSON.stringify(r.body.error))
              }
              expect(r.body).to.have.property("success", true)
              expect(r.headers['content-type']).to.match(/json/)
              expect(r.status).that.equals(201)
              Promise.resolve(r.body)
            })
            .catch(err => Promise.reject(err))
    }
  });

  it('registered user #0 cannot create another invite record with inviteJwt because it is too many', async () => {
    const inviteIdentifierTemp =
      Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2);
    const registerUnknownBy0ObjTemp = R.clone(registerUnknownBy0Obj)
    registerUnknownBy0ObjTemp.claim.identifier = inviteIdentifierTemp
    const registerUnknownBy0EncTemp = await credentials[0].createVerification(registerUnknownBy0ObjTemp)
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ inviteJwt: registerUnknownBy0EncTemp, notes: inviteNotes })
      .then(r => {
        console.log(r.body)
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user #0 cannot create another invite record with inviteIdentifier because it is too many', async () => {
    const inviteIdentifierTemp =
      Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2)
      + Math.random().toString(36).substring(2);
    return request(Server)
      .post('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ inviteIdentifier: inviteIdentifierTemp, notes: inviteNotes })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

  it('registered user #0 can retrieve all their invite records (randomly fails... why?)', () => {
    return request(Server)
      .get('/api/userUtil/invite')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        expect(r.body.data).to.be.an('array').of.length(EXPECTED_LIMIT)
        // console.log("inviteIdentifier1", inviteIdentifier1)
        // console.log("r.body.data ids", r.body.data.map(d => d.inviteIdentifier))
        // Why does this next line intermittently fail?
        expect(r.body.data[0]).to.have.property("inviteIdentifier", inviteIdentifier1)
        expect(r.body.data[0]).to.have.property("notes")
        expect(r.body.data[0]).to.have.property("expiresAt")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(200)
      })
      .catch(err => Promise.reject(err))
  });

  it('invite creator #0 cannot redeem their own registration', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
    .post('/api/v2/claim')
    .set('Authorization', 'Bearer ' + pushTokens[0])
    .send({ jwtEncoded: registerUnknownBy0Enc1 })
    .then(r => {
      expect(r.body).to.have.property("error")
      expect(r.headers['content-type']).to.match(/json/)
      expect(r.status).that.equals(400)
    })
    .catch(err => Promise.reject(err))
  });

  it('user #13 cannot see details from user #0', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
    .get('/api/claim?issuer=' + creds[0].did)
    .set('Authorization', 'Bearer ' + pushTokens[13])
    .then(r => {
      if (r.body.error) {
        throw new Error(JSON.stringify(r.body.error))
      }
      expect(r.body).to.be.an("array").of.length(0)
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

  it('user #13 can register from the invite', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
      .post('/api/v2/claim')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .send({ jwtEncoded: registerUnknownBy0Enc1 })
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

  it('user #13 can see details from user #0 after registration', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
    .get('/api/claim?issuer=' + creds[0].did)
    .set('Authorization', 'Bearer ' + pushTokens[13])
    .then(r => {
      if (r.body.error) {
        throw new Error(JSON.stringify(r.body.error))
      }
      expect(r.body[0].issuer).to.equal(creds[0].did)
      expect(r.headers['content-type']).to.match(/json/)
      expect(r.status).that.equals(200)
    })
    .catch(err => Promise.reject(err))
  });

  it('user #13 can now make a claim after registration', async () => {
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
      .get('/api/userUtil/invite/' + inviteIdentifier1)
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

  it('another user cannot use the same invite', async() => {
    // That JWT is passed to someone else who can use it to register.
    return request(Server)
      .post('/api/v2/claim')
      .set('Authorization', 'Bearer ' + pushTokens[13])
      .send({ jwtEncoded: registerUnknownBy0Enc1 })
      .then(r => {
        expect(r.body).to.have.property("error")
        expect(r.status).that.equals(400)
      })
      .catch(err => Promise.reject(err))
  });

  // a totally new user cannot see any info from user #0
  const newIdentity = Credentials.createIdentity()
  it('totally new user cannot see any info from user #0', async() => {
    const cred = new Credentials(newIdentity)
    const newJwt = await cred.createVerification({ exp: testUtil.nextMinuteEpoch })
    return request(Server)
    .get('/api/claim?issuer=' + creds[0].did)
    .set('Authorization', 'Bearer ' + newJwt)
    .then(r => {
      expect(r.body).to.be.an("array").of.length(0)
      expect(r.status).that.equals(200)
    })
    .catch(err => Promise.reject(err))
  })

  it('user #0 can delete an invite record', () => {
    return request(Server)
      .delete('/api/userUtil/invite/' + inviteIdentifier1)
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .then(r => {
        if (r.body.error) {
          throw new Error(JSON.stringify(r.body.error))
        }
        // for some reason the response has a body of {} and no content type
        // expect(r.body).to.have.property("success", true)
        // expect(r.body).to.have.property("numDeleted", 1)
        // expect(r.headers['content-type']).to.match(/json/)
        expect(r.status).that.equals(204)
      })
      .catch(err => Promise.reject(err))
  });

});
