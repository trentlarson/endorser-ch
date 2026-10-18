import chai from "chai";
import request from "supertest";
import { Credentials } from "uport-credentials";
import R from "ramda";

import Server from "../dist";
import { HIDDEN_TEXT } from "../dist/api/services/util";
import testUtil from "./util";

const expect = chai.expect;

const creds = testUtil.ethrCredData;
const credentials = R.map((c) => new Credentials(c), creds);
const pushTokenProms = R.map(
  (c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }),
  credentials
);
let pushTokens;

before(async () => {
  await Promise.all(pushTokenProms).then((jwts) => {
    pushTokens = jwts;
  });
  return Promise.resolve();
});

/**
 * Registration tree (established by prior tests):
 *   User 0 (root)
 *   ├── User 1
 *   │   └── User 16
 *   ├── User 2
 *   │   ├── User 17
 *   │   └── User 18
 *   └── Users 3-15
 */

let selfClaimId, directChildClaimId, deepClaimId, multiDidClaimId;

// expect at least one hidden entry, and every hidden one to have these neighbors
function expectHiddenEntries(data, expectedNeighbors) {
  const hiddenKeys = Object.keys(data).filter((key) => key.startsWith(HIDDEN_TEXT + "_"));
  expect(hiddenKeys).to.not.be.empty;
  for (const key of hiddenKeys) {
    expect(data[key]).to.deep.equal(expectedNeighbors);
  }
}

describe("P7 - Claim Nearest Neighbors", () => {

  // Create a claim by user 0 about themselves (issuer = self, no other DIDs)
  it("should create a claim by user 0 (self)", async () => {
    const jwtObj = R.clone(testUtil.jwtTemplate)
    jwtObj.claim = R.clone(testUtil.claimGive)
    jwtObj.claim.agent = { identifier: creds[0].did }
    delete jwtObj.claim.recipient
    delete jwtObj.claim.fulfills
    jwtObj.sub = creds[0].did
    const jwtEnc = await credentials[0].createVerification(jwtObj)
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ jwtEncoded: jwtEnc })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.be.a('string')
        selfClaimId = r.body
      });
  });

  // Create a claim by user 0 with user 1 as recipient (directly connected)
  it("should create a claim by user 0 giving to user 1", async () => {
    const jwtObj = R.clone(testUtil.jwtTemplate)
    jwtObj.claim = R.clone(testUtil.claimGive)
    jwtObj.claim.agent = { identifier: creds[0].did }
    jwtObj.claim.recipient = { identifier: creds[1].did }
    delete jwtObj.claim.fulfills
    jwtObj.sub = creds[0].did
    const jwtEnc = await credentials[0].createVerification(jwtObj)
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ jwtEncoded: jwtEnc })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.be.a('string')
        directChildClaimId = r.body
      });
  });

  // Create a claim by user 1 with user 16 as agent (multiple steps from user 0)
  it("should create a claim by user 1 about user 16", async () => {
    const jwtObj = R.clone(testUtil.jwtTemplate)
    jwtObj.claim = R.clone(testUtil.claimGive)
    jwtObj.claim.agent = { identifier: creds[16].did }
    delete jwtObj.claim.recipient
    delete jwtObj.claim.fulfills
    jwtObj.sub = creds[1].did
    const jwtEnc = await credentials[1].createVerification(jwtObj)
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({ jwtEncoded: jwtEnc })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.be.a('string')
        deepClaimId = r.body
      });
  });

  // Create a claim with multiple DIDs: issuer=0, agent=1, recipient=18
  it("should create a claim by user 0 with agent=1 and recipient=18", async () => {
    const jwtObj = R.clone(testUtil.jwtTemplate)
    jwtObj.claim = R.clone(testUtil.claimGive)
    jwtObj.claim.agent = { identifier: creds[1].did }
    jwtObj.claim.recipient = { identifier: creds[18].did }
    delete jwtObj.claim.fulfills
    jwtObj.sub = creds[0].did
    const jwtEnc = await credentials[0].createVerification(jwtObj)
    return request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[0])
      .send({ jwtEncoded: jwtEnc })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.be.a('string')
        multiDidClaimId = r.body
      });
  });

  // -- Self: requester is the issuer and only DID, so result should be TARGET --
  it("should return TARGET when requester is the only DID in the claim", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + selfClaimId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        const entry = r.body.data[creds[0].did];
        expect(entry).to.be.an("array").with.lengthOf(1);
        expect(entry[0]).to.have.property("did", creds[0].did);
        expect(entry[0]).to.have.property("relation", "TARGET");
      });
  });

  // -- User 1 views claim issued by user 0 (user 0 registered user 1, so REGISTERED_YOU) --
  it("should return REGISTERED_YOU when user 1 views a claim issued by user 0", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + selfClaimId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        const entry = r.body.data[creds[0].did];
        expect(entry).to.be.an("array").with.lengthOf(1);
        expect(entry[0]).to.have.property("did", creds[0].did);
        expect(entry[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // -- Direct connection: user 1 views claim with issuer=0 and recipient=1 --
  it("should show REGISTERED_YOU for issuer and TARGET for self when user 1 views a claim issued by user 0", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + directChildClaimId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        // issuer is user 0; user 1 was registered by user 0
        const issuerEntry = r.body.data[creds[0].did];
        expect(issuerEntry).to.be.an("array").with.lengthOf(1);
        expect(issuerEntry[0]).to.have.property("did", creds[0].did);
        expect(issuerEntry[0]).to.have.property("relation", "REGISTERED_YOU");
        // recipient is user 1 (the requester), so TARGET
        const selfEntry = r.body.data[creds[1].did];
        expect(selfEntry).to.be.an("array").with.lengthOf(1);
        expect(selfEntry[0]).to.have.property("did", creds[1].did);
        expect(selfEntry[0]).to.have.property("relation", "TARGET");
      });
  });

  // -- User 0 views claim with recipient=1: direct child --
  it("should show REGISTERED_BY_YOU when user 0 views claim with recipient user 1", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + directChildClaimId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        // recipient is user 1; user 0 registered user 1
        const recipientEntry = r.body.data[creds[1].did];
        expect(recipientEntry).to.be.an("array").with.lengthOf(1);
        expect(recipientEntry[0]).to.have.property("did", creds[1].did);
        expect(recipientEntry[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  // -- Multiple steps: user 0 views claim with agent=16 (registered by 1, who is registered by 0) --
  it("should show user 1 as nearest neighbor when user 0 views claim with user 16", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + deepClaimId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        // user 16 is registered by user 1 who is registered by user 0
        // so nearest neighbor from 0 toward 16 is user 1
        // ... but user 16 is hidden from user 0, so that entry has a hidden key
        expect(r.body.data).to.not.have.property(creds[16].did);
        expectHiddenEntries(r.body.data, [{ did: creds[1].did, relation: "REGISTERED_BY_YOU" }]);
      });
  });

  // -- Multiple steps: user 18 views claim with agent=16 (cousin path: 18->2->0->1->16) --
  it("should show user 2 as nearest neighbor when user 18 views claim with user 16", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + deepClaimId)
      .set("Authorization", "Bearer " + pushTokens[18])
      .then((r) => {
        expect(r.status).to.equal(200);
        // user 18 was registered by user 2, so nearest neighbor going up is user 2
        // ... but user 16 is hidden from user 18, so that entry has a hidden key
        expect(r.body.data).to.not.have.property(creds[16].did);
        expectHiddenEntries(r.body.data, [{ did: creds[2].did, relation: "REGISTERED_YOU" }]);
      });
  });

  // -- Multiple DIDs in one claim: user 16 views claim with issuer=0, agent=1, recipient=18 --
  it("should return neighbors for all DIDs when user 16 views multi-DID claim", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + multiDidClaimId)
      .set("Authorization", "Bearer " + pushTokens[16])
      .then((r) => {
        expect(r.status).to.equal(200);
        const data = r.body.data;

        // users 0 and 18 are hidden from user 16, keyed in the order of the claim
        expect(data).to.not.have.property(creds[0].did);
        expect(data).to.not.have.property(creds[18].did);

        // user 0 (issuer): user 16's path goes 16->1->0, so nearest is user 1
        const entry0 = data[HIDDEN_TEXT + "_0"];
        expect(entry0).to.be.an("array").with.lengthOf(1);
        expect(entry0[0]).to.have.property("did", creds[1].did);
        expect(entry0[0]).to.have.property("relation", "REGISTERED_YOU");

        // user 1 (agent): user 16 was registered by user 1, direct parent
        const entry1 = data[creds[1].did];
        expect(entry1).to.be.an("array").with.lengthOf(1);
        expect(entry1[0]).to.have.property("did", creds[1].did);
        expect(entry1[0]).to.have.property("relation", "REGISTERED_YOU");

        // user 18 (recipient): user 16's path goes 16->1->0->2->18, nearest is user 1
        const entry18 = data[HIDDEN_TEXT + "_1"];
        expect(entry18).to.be.an("array").with.lengthOf(1);
        expect(entry18[0]).to.have.property("did", creds[1].did);
        expect(entry18[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // -- Hidden DIDs: each key is visible in the claim, or else hidden --
  it("should hide the DIDs in keys that the requester cannot see in the claim", async () => {
    const views = [
      [deepClaimId, 17], [deepClaimId, 18], [multiDidClaimId, 17], [directChildClaimId, 18],
    ]
    let numHidden = 0
    for (const [claimId, userIndex] of views) {
      const claimResp = await request(Server)
        .get("/api/claim/" + claimId)
        .set("Authorization", "Bearer " + pushTokens[userIndex])
      expect(claimResp.status).to.equal(200)
      const visibleClaimText = JSON.stringify(claimResp.body)

      const r = await request(Server)
        .get("/api/claim/claimNearestNeighbors/" + claimId)
        .set("Authorization", "Bearer " + pushTokens[userIndex])
      expect(r.status).to.equal(200)
      const keys = Object.keys(r.body.data)
      for (const key of keys) {
        if (key.startsWith(HIDDEN_TEXT + "_")) {
          numHidden++
          expect(visibleClaimText).to.include(HIDDEN_TEXT)
          expect(r.body.data[key]).to.be.an("array")
        } else {
          expect(visibleClaimText).to.include(key)
        }
      }
      // no key is a DID that the claim hides from this requester
      for (const cred of creds) {
        if (!visibleClaimText.includes(cred.did)) {
          expect(keys).to.not.include(cred.did)
        }
      }
    }
    // make sure this test exercises the hiding
    expect(numHidden).to.be.greaterThan(0)
  })

  // -- Error cases --
  it("should return 404 for non-existent claim", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/999999")
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(404);
        expect(r.body).to.have.property("error");
      });
  });

  it("should return 400 when authorization is missing", () => {
    return request(Server)
      .get("/api/claim/claimNearestNeighbors/" + selfClaimId)
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body).to.have.property("error");
      });
  });
});
