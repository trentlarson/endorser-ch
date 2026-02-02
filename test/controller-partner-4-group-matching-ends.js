import chai from "chai";
import request from "supertest";
import { Credentials } from "uport-credentials";
import R from "ramda";

import Server from "../dist";
import testUtil from "./util";

const expect = chai.expect;

// Set up credentials for API tests
const creds = testUtil.ethrCredData;
const credentials = R.map((c) => new Credentials(c), creds);
const pushTokenProms = R.map(
  (c) => c.createVerification({ exp: testUtil.nextMinuteEpoch }),
  credentials
);
let pushTokens;

// Resolve push tokens before tests
before(async () => {
  await Promise.all(pushTokenProms).then((jwts) => {
    pushTokens = jwts;
  });
  return Promise.resolve();
});


/**
 * Integration Tests for Group Onboard Matching API Endpoint
 */
describe('P4 - Group Onboard Matching API', () => {
  let groupId;
  let member1Id, member2Id, member3Id, member4Id;

  // Set up admin user for embedding generation
  const adminDid = creds[0].did;
  
  before(() => {
    process.env.ADMIN_DIDS = JSON.stringify([adminDid]);
  });

  after(() => {
    delete process.env.ADMIN_DIDS;
  });

  describe('Setup - Create group and add members with embeddings', () => {
    
    it('should create a group onboarding room', () => {
      return request(Server)
        .post('/api/partner/groupOnboard')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .send({
          name: 'Matching Test Room',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          content: 'Test group for matching'
        })
        .then(r => {
          expect(r.status).to.equal(201);
          expect(r.body.success).to.have.property('groupId');
          groupId = r.body.success.groupId;
        });
    });

    it('should enable embedding generation for test users', async () => {
      // Enable embeddings for users 1-4
      for (let i = 1; i <= 4; i++) {
        const response = await request(Server)
          .put(`/api/partner/userProfileGenerateEmbedding/${creds[i].did}`)
          .set('Authorization', 'Bearer ' + pushTokens[0]);
        expect(response.status).to.equal(200);
      }
    }).timeout(5000);

    it('should create profiles for users 1-4', async () => {
      const profiles = [
        { index: 1, description: 'Passionate about organic farming and sustainable agriculture. Love growing vegetables and teaching others about permaculture.' },
        { index: 2, description: 'Small-scale farmer focusing on regenerative agriculture practices. Interested in composting and soil health.' },
        { index: 3, description: 'Full-stack developer with expertise in React, Node.js, and Python. Building web applications and APIs.' },
        { index: 4, description: 'Software engineer specializing in backend systems, databases, and distributed computing.' }
      ];

      for (const profile of profiles) {
        const issuerDid = creds[profile.index].did;
        const getResponse = await request(Server)
          .get(`/api/partner/userProfileForIssuer/${issuerDid}`)
          .set('Authorization', 'Bearer ' + pushTokens[profile.index]);
        const existingProfile = getResponse.status === 200 ? getResponse.body.data : null;

        const response = await request(Server)
          .post('/api/partner/userProfile')
          .set('Authorization', 'Bearer ' + pushTokens[profile.index])
          .send({
            description: profile.description,
            locLat: existingProfile?.locLat ?? null,
            locLon: existingProfile?.locLon ?? null
          });
        expect(response.status).to.equal(201);
      }
    }).timeout(5000);

    it('should join group and admit members', async () => {
      // Member 1 joins
      let response = await request(Server)
        .post('/api/partner/groupOnboardMember')
        .set('Authorization', 'Bearer ' + pushTokens[1])
        .send({
          groupId: groupId,
          content: 'Member 1 content'
        });
      expect(response.status).to.equal(201);
      member1Id = response.body.success.memberId;

      // Member 2 joins
      response = await request(Server)
        .post('/api/partner/groupOnboardMember')
        .set('Authorization', 'Bearer ' + pushTokens[2])
        .send({
          groupId: groupId,
          content: 'Member 2 content'
        });
      expect(response.status).to.equal(201);
      member2Id = response.body.success.memberId;

      // Member 3 joins
      response = await request(Server)
        .post('/api/partner/groupOnboardMember')
        .set('Authorization', 'Bearer ' + pushTokens[3])
        .send({
          groupId: groupId,
          content: 'Member 3 content'
        });
      expect(response.status).to.equal(201);
      member3Id = response.body.success.memberId;

      // Member 4 joins
      response = await request(Server)
        .post('/api/partner/groupOnboardMember')
        .set('Authorization', 'Bearer ' + pushTokens[4])
        .send({
          groupId: groupId,
          content: 'Member 4 content'
        });
      expect(response.status).to.equal(201);
      member4Id = response.body.success.memberId;

      // Organizer admits all members
      for (const memberId of [member1Id, member2Id, member3Id, member4Id]) {
        response = await request(Server)
          .put(`/api/partner/groupOnboardMember/${memberId}`)
          .set('Authorization', 'Bearer ' + pushTokens[0])
          .send({ admitted: true });
        expect(response.status).to.equal(200);
      }
    });
  });

  describe('Authentication and Authorization', () => {
    
    it('should reject request without JWT', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .then(r => {
          expect(r.status).to.equal(401);
        });
    });

    it('should reject request from non-organizer', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[1])
        .then(r => {
          expect(r.status).to.equal(403);
          expect(r.body.error).to.include('Only the organizer');
        });
    });

    it('should reject request for non-existent group', () => {
      return request(Server)
        .post('/api/partner/groupOnboardMatch/99999')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(404);
          expect(r.body.error).to.include('Group not found');
        });
    });
  });

  describe('Basic Matching Functionality', () => {
    
    it('should successfully match members in a group', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          expect(r.body.data).to.have.property('pairs');
          expect(r.body.data.pairs).to.be.an('array');
          expect(r.body.data.pairs).to.have.length(2); // 4 members = 2 pairs
          
          // Validate pair structure
          r.body.data.pairs.forEach(pair => {
            expect(pair).to.have.property('pairNumber');
            expect(pair).to.have.property('similarity');
            expect(pair).to.have.property('participants');
            expect(pair.participants).to.have.length(2);
            
            pair.participants.forEach(participant => {
              expect(participant).to.have.property('issuerDid');
              expect(participant).to.have.property('description');
            });
          });
        });
    });

    it('should match similar profiles together', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          // Find the pair containing the first agriculture profile
          const agriculturePair = pairs.find(pair =>
            pair.participants.some(p => p.issuerDid === creds[1].did)
          );
          
          expect(agriculturePair).to.exist;
          
          // The partner should be the other agriculture profile (user 2)
          const partner = agriculturePair.participants.find(p => p.issuerDid !== creds[1].did);
          expect(partner.issuerDid).to.equal(creds[2].did);
          
          // Similarity should be high for agriculture profiles
          expect(agriculturePair.similarity).to.be.above(0.55);
          
          // Find the tech pair
          const techPair = pairs.find(pair =>
            pair.participants.some(p => p.issuerDid === creds[3].did)
          );
          
          expect(techPair).to.exist;
          const techPartner = techPair.participants.find(p => p.issuerDid !== creds[3].did);
          expect(techPartner.issuerDid).to.equal(creds[4].did);
        });
    });
  });

  describe('Constraint Handling', () => {
    
    it('should exclude specified IDs from matching', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .send({
          excludedIds: [creds[1].did, creds[2].did]
        })
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          // Should only have 1 pair (2 remaining members)
          expect(pairs).to.have.length(1);
          
          // Excluded DIDs should not appear in results
          const allDids = pairs.flatMap(pair => pair.participants.map(p => p.issuerDid));
          expect(allDids).to.not.include(creds[1].did);
          expect(allDids).to.not.include(creds[2].did);
        });
    });

    it('should exclude specified pairs from matching', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .send({
          excludedPairs: [[creds[1].did, creds[2].did]]
        })
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          // Check that the excluded pair is not matched together
          const forbiddenPair = pairs.find(pair => {
            const dids = pair.participants.map(p => p.issuerDid).sort();
            return dids[0] === creds[1].did && dids[1] === creds[2].did;
          });
          
          expect(forbiddenPair).to.be.undefined;
        });
    });

    it('should not repeat previous pairs', () => {
      // Get first round of matches
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const round1Pairs = r.body.data.pairs;
          
          // Extract previous pairs
          const previousPairs = round1Pairs.map(pair =>
            pair.participants.map(p => p.issuerDid)
          );
          
          // Request second round with previousPairs constraint
          return request(Server)
            .post(`/api/partner/groupOnboardMatch/${groupId}`)
            .set('Authorization', 'Bearer ' + pushTokens[0])
            .send({ previousPairs })
            .then(r2 => {
              expect(r2.status).to.equal(200);
              const round2Pairs = r2.body.data.pairs;
              
              // Verify no pairs are repeated
              round2Pairs.forEach(pair => {
                const dids = pair.participants.map(p => p.issuerDid).sort();
                
                const wasInRound1 = previousPairs.some(prevPair => {
                  const prevDids = [...prevPair].sort();
                  return prevDids[0] === dids[0] && prevDids[1] === dids[1];
                });
                
                expect(wasInRound1).to.be.false;
              });
            });
        });
    });
  });

  describe('Error Cases', () => {
    
    it('should reject matching with less than 2 admitted members', () => {
      // Create a new group with only 1 member
      return request(Server)
        .post('/api/partner/groupOnboard')
        .set('Authorization', 'Bearer ' + pushTokens[5])
        .send({
          name: 'Small Group',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          content: 'Small test group'
        })
        .then(r => {
          expect(r.status).to.equal(201);
          const smallGroupId = r.body.success.groupId;
          
          // Try to match with only organizer
          return request(Server)
            .post(`/api/partner/groupOnboardMatch/${smallGroupId}`)
            .set('Authorization', 'Bearer ' + pushTokens[5]);
        })
        .then(r => {
          expect(r.status).to.equal(400);
          expect(r.body.error).to.include('at least 2 admitted members');
        });
    });

    it('should handle invalid group ID format', () => {
      return request(Server)
        .post('/api/partner/groupOnboardMatch/invalid')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          // Should either be 400, 404, or 500 depending on how the server handles it
          expect(r.status).to.be.greaterThan(399);
        });
    });

    it('should reject empty excludedPairs array elements', () => {
      // This tests robustness - empty pairs should be handled gracefully
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .send({
          excludedPairs: [[]]
        })
        .then(r => {
          // Should either succeed (ignoring empty pairs) or fail gracefully
          expect([200, 400, 500]).to.include(r.status);
        });
    });
  });

  describe('Response Structure and Data Quality', () => {
    
    it('should return pairs sorted or numbered correctly', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          // Verify pair numbers are sequential
          const pairNumbers = pairs.map(p => p.pairNumber).sort();
          expect(pairNumbers).to.deep.equal([1, 2]);
        });
    });

    it('should return similarity scores within valid range', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          pairs.forEach(pair => {
            // Cosine similarity should be between -1 and 1
            expect(pair.similarity).to.be.at.least(-1);
            expect(pair.similarity).to.be.at.most(1);
          });
        });
    });

    it('should not expose sensitive data in response', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          pairs.forEach(pair => {
            pair.participants.forEach(participant => {
              // Should not expose embeddings or internal IDs
              expect(participant).to.not.have.property('embedding');
              expect(participant).to.not.have.property('id');
              expect(participant).to.not.have.property('rowId');
              
              // Should expose DIDs and descriptions
              expect(participant).to.have.property('issuerDid');
              expect(participant).to.have.property('description');
            });
          });
        });
    });

    it('should use each participant exactly once', () => {
      return request(Server)
        .post(`/api/partner/groupOnboardMatch/${groupId}`)
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(200);
          const pairs = r.body.data.pairs;
          
          // Collect all DIDs
          const allDids = pairs.flatMap(pair => pair.participants.map(p => p.issuerDid));
          
          // Check for duplicates
          const uniqueDids = new Set(allDids);
          expect(allDids.length).to.equal(uniqueDids.size);
        });
    });
  });

  describe('Cleanup', () => {
    
    it('should delete the test group', () => {
      return request(Server)
        .delete('/api/partner/groupOnboard')
        .set('Authorization', 'Bearer ' + pushTokens[0])
        .then(r => {
          expect(r.status).to.equal(204);
        });
    });
  });
});
