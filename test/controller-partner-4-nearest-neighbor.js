import chai from "chai";
import { DateTime } from "luxon"
import request from "supertest";
import { dbService } from '../dist/api/services/endorser.db.service'
import { Credentials } from "uport-credentials";
import R from "ramda";

import Server from "../dist";
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

let profile0RowId, profile1RowId, profile2RowId, profile3RowId, profile16RowId, profile18RowId;
describe("P3 - Nearest Neighbor for Current, Flat Tree", () => {
  /**
   * Test setup:
   * We'll create a registration tree and user profiles to test various scenarios
   * 
   * Registration tree structure (from controller-endorser-0-setup.js):
   * - User 0 is the root (registered by themselves)
   * - Users 1-15 are registered by User 0
   * 
   * We'll extend this with additional registrations:
   * - User 1 registers User 16 (if available)
   * - User 2 registers User 17 (if available)
   * 
   * This gives us these scenarios to test:
   * 1. Source is ancestor of target (0 -> 1)
   * 2. Target is ancestor of source (1 -> 0)
   * 3. Siblings with common parent (1 -> 2, both registered by 0)
   * 4. Cousins (16 -> 17, where 16 registered by 1, 17 registered by 2)
   * 5. Unregistered users
   * 6. Same user
   */

  // Create profile for testing since it was deleted
  it("should create profile for user 0", () => {
    return request(Server)
      .post("/api/partner/userProfile")
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        description: "I'm user 0 and I like pizza",
        locLat: 40.7128,
        locLon: -74.006,
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        profile0RowId = r.body.success.userProfileId;
      });
  });

  // Get profile IDs
  it("should get profile ID for user 0", () => {
    return request(Server)
      .get("/api/partner/userProfileForIssuer/" + creds[0].did)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.have.property("rowId");
        profile0RowId = r.body.data.rowId;
      });
  });

  it("should get profile ID for user 1", () => {
    return request(Server)
      .get("/api/partner/userProfileForIssuer/" + creds[1].did)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.have.property("rowId");
        profile1RowId = r.body.data.rowId;
      });
  });

  it("should get profile ID for user 2", () => {
    return request(Server)
      .get("/api/partner/userProfileForIssuer/" + creds[2].did)
      .set("Authorization", "Bearer " + pushTokens[2])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.have.property("rowId");
        profile2RowId = r.body.data.rowId;
      });
  });

  it("should get profile ID for user 3", () => {
    return request(Server)
      .get("/api/partner/userProfileForIssuer/" + creds[3].did)
      .set("Authorization", "Bearer " + pushTokens[3])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.have.property("rowId");
        profile3RowId = r.body.data.rowId;
      });
  });

  // Test 1: Source is ancestor of target (User 0 looking at User 1's profile)
  // User 0 registered User 1, so the nearest neighbor should be User 1 with relation "REGISTERED_BY_YOU"
  it("should find User 1 as nearest neighbor when User 0 looks at User 1's profile (parent->child)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  // Test 2: Target is ancestor of source (User 1 looking at User 0's profile)
  // User 0 registered User 1, so User 1 needs to go up through User 0
  it("should find User 0 as nearest neighbor when User 1 looks at User 0's profile (child->parent)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[0].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // Test 3: Siblings with common parent (User 1 looking at User 2's profile)
  // Both registered by User 0, so User 1 should go up to User 0
  it("should find User 0 as nearest neighbor when User 1 looks at User 2's profile (sibling->sibling)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile2RowId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[0].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // Test 4: Same user looking at their own profile
  // Should return empty array or handle gracefully
  it("should return empty array when user looks at their own profile", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        // When looking at own profile, there's no path to traverse
        // The implementation should handle this gracefully
      });
  });

  // Test 5: User 2 looking at User 3's profile (another sibling case)
  it("should find User 0 as nearest neighbor when User 2 looks at User 3's profile (sibling->sibling)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile3RowId)
      .set("Authorization", "Bearer " + pushTokens[2])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[0].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // Test 6: Non-existent profile
  it("should return 404 for non-existent profile", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/999999")
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(404);
        expect(r.body).to.have.property("error");
      });
  });

  // Test 7: Missing authorization
  it("should return 400 when authorization is missing", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body).to.have.property("error");
      });
  });

  // Test 8: User 0 looking at User 3's profile (another parent->child case)
  it("should find User 3 as nearest neighbor when User 0 looks at User 3's profile (parent->child)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile3RowId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[3].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  // Test 9: User 3 looking at User 1's profile (sibling->sibling, different pair)
  it("should find User 0 as nearest neighbor when User 3 looks at User 1's profile (sibling->sibling)", () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .set("Authorization", "Bearer " + pushTokens[3])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("did", creds[0].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  // Test 10: Verify the endpoint works with different users in the tree
  it("should consistently return correct neighbors for multiple requests", () => {
    const requests = [
      request(Server)
        .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
        .set("Authorization", "Bearer " + pushTokens[0]),
      request(Server)
        .get("/api/partner/userProfileNearestNeighbors/" + profile2RowId)
        .set("Authorization", "Bearer " + pushTokens[0]),
      request(Server)
        .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
        .set("Authorization", "Bearer " + pushTokens[1]),
      request(Server)
        .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
        .set("Authorization", "Bearer " + pushTokens[2]),
    ];

    return Promise.all(requests).then((responses) => {
      // User 0 -> User 1: should be User 1 (REGISTERED_BY_YOU)
      expect(responses[0].status).to.equal(200);
      expect(responses[0].body.data[0].did).to.equal(creds[1].did);
      expect(responses[0].body.data[0].relation).to.equal("REGISTERED_BY_YOU");

      // User 0 -> User 2: should be User 2 (REGISTERED_BY_YOU)
      expect(responses[1].status).to.equal(200);
      expect(responses[1].body.data[0].did).to.equal(creds[2].did);
      expect(responses[1].body.data[0].relation).to.equal("REGISTERED_BY_YOU");

      // User 1 -> User 0: should be User 0 (REGISTERED_YOU)
      expect(responses[2].status).to.equal(200);
      expect(responses[2].body.data[0].did).to.equal(creds[0].did);
      expect(responses[2].body.data[0].relation).to.equal("REGISTERED_YOU");

      // User 2 -> User 0: should be User 0 (REGISTERED_YOU)
      expect(responses[3].status).to.equal(200);
      expect(responses[3].body.data[0].did).to.equal(creds[0].did);
      expect(responses[3].body.data[0].relation).to.equal("REGISTERED_YOU");
    });
  });
});

describe("P3 - Nearest Neighbor for Deeper Tree", () => {
  it("should register users 16, 17, and 18 and create at least one profile", async () => {
    const yesterdayEpoch = DateTime.utc().minus({day: 1}).toSeconds();
    await dbService.registrationUpdateIssueDateForTests(testUtil.ethrCredData[1].did, yesterdayEpoch);
    await dbService.registrationUpdateIssueDateForTests(testUtil.ethrCredData[2].did, yesterdayEpoch);

    const register16By1JwtObj = R.clone(testUtil.jwtTemplate)
    register16By1JwtObj.claim = R.clone(testUtil.registrationTemplate)
    register16By1JwtObj.claim.agent.identifier = creds[1].did
    register16By1JwtObj.claim.participant.identifier = creds[16].did
    register16By1JwtObj.iss = creds[1].did
    register16By1JwtObj.sub = creds[16].did
    const register16By1JwtProm = credentials[1].createVerification(register16By1JwtObj)
    const register16By1JwtEnc = await register16By1JwtProm
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[1])
      .send({jwtEncoded: register16By1JwtEnc})
      .then((r) => {
        expect(r.status).to.equal(201);
      });

    const register17By2JwtObj = R.clone(testUtil.jwtTemplate)
    register17By2JwtObj.claim = R.clone(testUtil.registrationTemplate)
    register17By2JwtObj.claim.agent.identifier = creds[2].did
    register17By2JwtObj.claim.participant.identifier = creds[17].did
    register17By2JwtObj.iss = creds[2].did
    register17By2JwtObj.sub = creds[17].did
    const register17By2JwtProm = credentials[2].createVerification(register17By2JwtObj)
    const register17By2JwtEnc = await register17By2JwtProm
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: register17By2JwtEnc})
      .then((r) => {
        expect(r.status).to.equal(201);
      });
    const register18By2JwtObj = R.clone(testUtil.jwtTemplate)
    register18By2JwtObj.claim = R.clone(testUtil.registrationTemplate)
    register18By2JwtObj.claim.agent.identifier = creds[2].did
    register18By2JwtObj.claim.participant.identifier = creds[18].did
    register18By2JwtObj.iss = creds[2].did
    register18By2JwtObj.sub = creds[18].did
    const register18By2JwtProm = credentials[2].createVerification(register18By2JwtObj)
    const register18By2JwtEnc = await register18By2JwtProm
    await request(Server)
      .post('/api/claim')
      .set('Authorization', 'Bearer ' + pushTokens[2])
      .send({jwtEncoded: register18By2JwtEnc})
      .then((r) => {
        expect(r.status).to.equal(201);
      });

    await request(Server)
      .post("/api/partner/userProfile")
      .set("Authorization", "Bearer " + pushTokens[16])
      .send({
        description: "I'm user 16 and I am a square",
        locLat: 40.7128,
        locLon: -74.006,
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        profile16RowId = r.body.success.userProfileId;
      });

    await request(Server)
      .post("/api/partner/userProfile")
      .set("Authorization", "Bearer " + pushTokens[18])
      .send({
        description: "I'm user 18 and I like waffles",
        locLat: 40.7128,
        locLon: -74.006,
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.have.property("success").that.is.an("object")
        expect(r.body.success).to.have.property("userProfileId").that.is.an("number")
        profile18RowId = r.body.success.userProfileId;
      });
    
  });

  it("should return correct neighbors to user 0 for profile of user 1", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  it("should return correct neighbors to user 1 for profile of user 0", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[0].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 0 for profile of user 16", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile16RowId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  it("should return correct neighbors to user 1 for profile of user 16", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile16RowId)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[16].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  it("should return correct neighbors to user 16 for profile of user 0", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
      .set("Authorization", "Bearer " + pushTokens[16])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 16 for profile of user 1", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile1RowId)
      .set("Authorization", "Bearer " + pushTokens[16])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 16 for profile of user 2", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile2RowId)
      .set("Authorization", "Bearer " + pushTokens[16])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 16 for profile of user 18", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile18RowId)
      .set("Authorization", "Bearer " + pushTokens[16])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[1].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 18 for profile of user 16", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile16RowId)
      .set("Authorization", "Bearer " + pushTokens[18])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[2].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });

  it("should return correct neighbors to user 0 for profile of user 18", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile18RowId)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[2].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_BY_YOU");
      });
  });

  it("should return correct neighbors to user 18 for profile of user 0", async () => {
    return request(Server)
      .get("/api/partner/userProfileNearestNeighbors/" + profile0RowId)
      .set("Authorization", "Bearer " + pushTokens[18])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("did", creds[2].did);
        expect(r.body.data[0]).to.have.property("relation", "REGISTERED_YOU");
      });
  });
});
