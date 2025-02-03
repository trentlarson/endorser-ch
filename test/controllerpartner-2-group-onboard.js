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

const SALT_LENGTH = 16; // probably don't need this
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000; // probably don't need this

// Encryption helper function
async function encryptMessage(message, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt']
  );

  // Encrypt the message
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoder.encode(message)
  );

  // Return a JSON structure with base64-encoded components
  return Buffer.from(JSON.stringify({
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    encrypted: Buffer.from(encryptedContent).toString('base64')
  })).toString('base64');
}

// Decryption helper function
async function decryptMessage(encryptedJson, password) {
  const decoder = new TextDecoder();
  const { salt, iv, encrypted } =
    JSON.parse(Buffer.from(encryptedJson, 'base64').toString());

  // Convert base64 components back to Uint8Arrays
  const saltArray = Buffer.from(salt, 'base64');
  const ivArray = Buffer.from(iv, 'base64');
  const encryptedContent = Buffer.from(encrypted, 'base64');

  // Derive the same key using PBKDF2 with the extracted salt
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArray,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['decrypt']
  );

  // Decrypt the content
  const decryptedContent = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivArray
    },
    key,
    encryptedContent
  );

  // Convert the decrypted content back to a string
  return decoder.decode(decryptedContent);
}

// Add a test to verify encryption/decryption works
describe("P2 - Shared Password Encryption", () => {
  const testMessage = '{"message": "Test message", "data": "sensitive"}';
  const sharedPassword = 'ceremony shared password';

  it("should successfully encrypt and decrypt a message with shared password", async () => {
    const encrypted = await encryptMessage(testMessage, sharedPassword);
    const decrypted = await decryptMessage(encrypted, sharedPassword);
    expect(decrypted).to.equal(testMessage);
  });

  it("should fail to decrypt with wrong password", async () => {
    const encrypted = await encryptMessage(testMessage, sharedPassword);
    try {
      await decryptMessage(encrypted, 'wrong password');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.exist;
    }
  });
});

// Encrypt the message before the tests
before(async () => {
  await Promise.all(pushTokenProms).then((jwts) => {
    pushTokens = jwts;
  });
  return Promise.resolve();
});

describe("P2 - Group Onboarding", () => {
  let groupId;
  let user0EncrMessage;

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
        expect(r.body.error.message).to.include("registration permissions");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can see no room of their own", () => {
    return request(Server)
      .get("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.undefined;
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  const MESSAGE = '{"message": "Hello, world!", "name": "Scarlet Pimpernel"}'
  const PASSWORD = 'I love scarlet.'
  it("can create a room with registration rights", async () => {
    // The content can be any string, typically base-64 encoded bytes which are
    // encrypted data. The server is not intended to decrypt the content, but
    // rather to forward it so that other members can request and decrypt it. 
    user0EncrMessage = await encryptMessage(MESSAGE, PASSWORD);
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        name: "Test Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        content: user0EncrMessage,
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        expect(r.body.success).to.have.property("groupId");
        groupId = r.body.success.groupId;
      }).catch((err) => {
        return Promise.reject(err)
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
        expect(r.body.error.message).to.include("already taken");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("cannot create a second room with same DID", () => {
    return request(Server)
      .post("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        name: "Another Room",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        content: user0EncrMessage,
      })
      .then((r) => {
        expect(r.status).to.equal(400);
        expect(r.body.error.message).to.include("already have an active group");
      }).catch((err) => {
        return Promise.reject(err)
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
        expect(r.body.error.message).to.include("24 hours");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can see their own room", () => {
    return request(Server)
      .get("/api/partner/groupOnboard")
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("object");
        expect(r.body.data).to.have.property("name", "Test Room");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can list all rooms", () => {
    return request(Server)
      .get("/api/partner/groupsOnboarding")
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("name", "Test Room");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("cannot update another user's room", () => {
    return request(Server)
      .put(`/api/partner/groupOnboard`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({ name: "Hacked Room" })
      .then((r) => {
        expect(r.status).to.equal(404);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can update own room name", () => {
    return request(Server)
      .put(`/api/partner/groupOnboard`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({ name: "Updated Room" })
      .then((r) => {
        expect(r.status).to.equal(200);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("cannot delete another user's room", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboard`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(404);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });





  /**
   * Group Onboarding Members
   */

  it("organizer can see all members, starting with themselves", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMembers`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then(async (r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array");
        expect(r.body.data).to.have.lengthOf(1);
        expect(r.body.data[0]).to.have.property("admitted");
        expect(r.body.data[0]).to.have.property("content");
        const decrypted = await decryptMessage(r.body.data[0].content, PASSWORD);
        expect(decrypted).to.equal(MESSAGE);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("non-admitted members cannot see other members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMembers/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.be.greaterThan(399).to.be.lessThan(500);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can see that they're not in a group", () => {
    return request(Server)
      .get("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.undefined;
      }).catch((err) => {
        return Promise.reject(err)
      });
  });


  let memberIdOne;
  it("can join a group", () => {
    return request(Server)
      .post("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        groupId: groupId,
        content: "Member 1 content"
      })
      .then((r) => {
        expect(r.status).to.equal(201);
        memberIdOne = r.body.success.memberId;
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can see that they're in a group", () => {
    return request(Server)
      .get("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("object");
        expect(r.body.data).to.have.property("groupId").that.equals(groupId);
        expect(r.body.data).to.have.property("content").that.equals("Member 1 content");
        expect(r.body.data).to.have.property("admitted").that.equals(false);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("cannot join the same group with different member info", () => {
    return request(Server)
      .post("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        groupId: groupId,
        content: "Duplicate content"
      })
      .then((r) => {
        expect(r.body.success.memberId).to.equal(memberIdOne);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("organizer can admit a member", () => {
    return request(Server)
      .put(`/api/partner/groupOnboardMember/${memberIdOne}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .send({
        admitted: true
      })
      .then((r) => {
        expect(r.status).to.equal(200);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can see that they're in a group and admitted", () => {
    return request(Server)
      .get("/api/partner/groupOnboardMember")
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("object");
        expect(r.body.data).to.have.property("groupId").that.equals(groupId);
        expect(r.body.data).to.have.property("admitted").that.equals(true);
        expect(r.body.data).to.have.property("content").that.equals("Member 1 content");
      }).catch((err) => {
        return Promise.reject(err)
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
        expect(r.status).to.be.greaterThan(399).to.be.lessThan(500);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("member can update their content", () => {
    return request(Server)
      .put(`/api/partner/groupOnboardMember`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .send({
        content: "Member 1 updated content"
      })
      .then((r) => {
        expect(r.status).to.equal(200);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("organizer can see all other members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMembers`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array").with.lengthOf(2);
        expect(r.body.data[0]).to.have.property("admitted");
        expect(r.body.data[0]).to.have.property("content");
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("admitted member can see other admitted members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMembers`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then(async (r) => {
        expect(r.status).to.equal(200);
        expect(r.body.data).to.be.an("array").with.lengthOf(2);
        expect(r.body.data[0]).to.not.have.property("admitted");
        expect(r.body.data[0]).to.have.property("content");
        expect(r.body.data[1]).to.have.property("content").that.equals("Member 1 updated content");
        const decrypted0 = await decryptMessage(r.body.data[0].content, PASSWORD);
        expect(decrypted0).to.equal(MESSAGE);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("non-member cannot see members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMembers`)
      .set("Authorization", "Bearer " + pushTokens[2])
      .then((r) => {
        expect(r.status).to.be.greaterThan(399).to.be.lessThan(500);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("member can leave group", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboardMember`)
      .set("Authorization", "Bearer " + pushTokens[1])
      .then((r) => {
        expect(r.status).to.equal(204);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("can delete own room", () => {
    return request(Server)
      .delete(`/api/partner/groupOnboard`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(204);
      }).catch((err) => {
        return Promise.reject(err)
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
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

  it("organizer cannot see any members", () => {
    return request(Server)
      .get(`/api/partner/groupOnboardMember/${groupId}`)
      .set("Authorization", "Bearer " + pushTokens[0])
      .then((r) => {
        expect(r.status).to.equal(404);
      }).catch((err) => {
        return Promise.reject(err)
      });
  });

});
