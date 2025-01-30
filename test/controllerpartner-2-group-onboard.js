import chai from "chai";
import request from "supertest";
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

describe("Group Onboarding", () => {
  let groupId;

  it("cannot create a room without registration permissions", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[15])
      .send({
        name: "Test Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error).to.include("registration permissions");
      });
  });

  it("can create a room with registration rights", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        name: "Test Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body).to.have.property("id");
        groupId = r.body.id;
      });
  });

  it("cannot create a room with duplicate name", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        name: "Test Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error).to.include("already taken");
      });
  });

  it("cannot create a second room with same DID", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        name: "Another Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error).to.include("already have an active group");
      });
  });

  it("cannot create a room with expiration > 24h", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        name: "Long Room",
        expiresAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error).to.include("24 hours");
      });
  });

  it("can list all rooms", () => {
    return request(Server)
      .get("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("name", "Test Room");
      });
  });

  it("cannot update another user's room", () => {
    return request(Server)
      .put(`/api/partner/groupOnboard/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({ name: "Hacked Room" })
      .then((r) => {
        expect(r.status).to.equal(404);
      });
  });

  it("can update own room name", () => {
    return request(Server)
      .put(`/api/partner/groupOnboard/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({ name: "Updated Room" })
      .then((r) => {
        expect(r.status).to.equal(200);
      });
  });

  it("cannot delete another user's room", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboard/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(404);
      });
  });

  it("can delete own room", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboard/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(204);
      });
  });





  /**
   * Group Onboarding Members
   */

  it("can join a group", () => {
    return request(Server)
      .post("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        groupOnboard: groupId,
        content: "Member 1 content"
      })
      .then((r) => {
        console.log(r.body)
        expect(r.status).to.equal(201);
      });
  });

  it("cannot join same group twice", () => {
    return request(Server)
      .post("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        groupOnboard: groupId,
        content: "Duplicate content"
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error).to.include("already a member");
      });
  });

  it("organizer can admit a member", () => {
    return request(Server)
      .put(`/api/partner/groupOnboardMember/${memberId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        memberDid: creds[1].did,
        admitted: true
      })
      .then((r) => {
        expect(r.status).to.equal(200);
      });
  });

  it("non-organizer cannot admit members", () => {
    return request(Server)
      .put(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        memberDid: creds[2].did,
        admitted: true
      })
      .then((r) => {
        expect(r.status).to.equal(403);
      });
  });

  it("member can update their content", () => {
    return request(Server)
      .put(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        content: "Updated content"
      })
      .then((r) => {
        expect(r.status).to.equal(200);
      });
  });

  it("organizer can see all members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.have.property("admitted");
        expect(r.body.data[0]).to.have.property("content");
      });
  });

  it("admitted member can see other admitted members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data[0]).to.not.have.property("admitted");
        expect(r.body.data[0]).to.have.property("content");
      });
  });

  it("non-member cannot see members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[2])
      .then((r) => {
        expect(r.status).to.equal(403);
      });
  });

  it("member can leave group", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(204);
      });
  });

  it("can delete own room", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboard/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(204);
      });
  });

  it("cannot join a deleted group", () => {
    return request(Server)
      .post("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        groupOnboard: groupId,
        content: "Member 1 content"
      })
      .then((r) => {
        expect(r.status).to.equal(404);
      });
  });

  it("organizer cannot see any members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(404);
      });
  });

});
