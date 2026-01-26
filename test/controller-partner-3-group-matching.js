import chai from "chai";

const expect = chai.expect;

/**
 * Phase 0: Vector Similarity Foundation Tests
 * 
 * This test suite validates the core vector math functions and matching algorithms
 * that will be used for AI-powered profile matching at events.
 */

// ============================================================================
// Core Vector Math Functions
// ============================================================================

/**
 * Calculate dot product of two vectors
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Dot product
 */
function dotProduct(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }
  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

/**
 * Calculate magnitude (length) of a vector
 * @param {number[]} vec - Input vector
 * @returns {number} Magnitude
 */
function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 (opposite) and 1 (identical)
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Similarity score
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }
  const dot = dotProduct(vec1, vec2);
  const mag1 = magnitude(vec1);
  const mag2 = magnitude(vec2);
  
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }
  
  return dot / (mag1 * mag2);
}

// ============================================================================
// Matching Algorithm Functions
// ============================================================================

/**
 * Create pairs from a list of participants based on similarity scores
 * @param {Array} participants - Array of participant objects with embeddings
 * @param {Array} excludedPairs - Array of [id1, id2] pairs to exclude
 * @param {Array} excludedIds - Array of participant IDs to exclude from matching
 * @param {Array} previousPairs - Array of previous round pairs to avoid repeating
 * @returns {Object} { pairs: Array }
 */
function matchParticipants(participants, excludedPairs = [], excludedIds = [], previousPairs = []) {
  // Filter out excluded participants
  const available = participants.filter(p => !excludedIds.includes(p.id));
  
  if (available.length < 2) {
    throw new Error('Need at least 2 participants for matching');
  }
  
  if (available.length % 2 !== 0) {
    throw new Error('Need an even number of participants for matching');
  }
  
  // Calculate all similarities
  const similarities = [];
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const p1 = available[i];
      const p2 = available[j];
      
      // Check if this pair is excluded
      const isExcluded = excludedPairs.some(([id1, id2]) => 
        (id1 === p1.id && id2 === p2.id) || (id1 === p2.id && id2 === p1.id)
      );
      
      // Check if this pair was in a previous round
      const wasPreviouslyPaired = previousPairs.some(([id1, id2]) =>
        (id1 === p1.id && id2 === p2.id) || (id1 === p2.id && id2 === p1.id)
      );
      
      if (!isExcluded && !wasPreviouslyPaired) {
        const similarity = cosineSimilarity(p1.embedding, p2.embedding);
        similarities.push({ i, j, p1, p2, similarity });
      }
    }
  }
  
  if (similarities.length === 0) {
    throw new Error('No valid pairs available after applying constraints');
  }
  
  // Sort by similarity (highest first)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Greedy pairing algorithm
  const pairs = [];
  const used = new Set();
  
  for (const { p1, p2, similarity } of similarities) {
    if (!used.has(p1.id) && !used.has(p2.id)) {
      pairs.push({
        participants: [p1, p2],
        similarity,
        pairNumber: pairs.length + 1
      });
      used.add(p1.id);
      used.add(p2.id);
    }
  }
  
  return { pairs };
}

// ============================================================================
// Test Data - Sample Profile Embeddings
// ============================================================================
// Note: These are simplified 10-dimensional vectors for quick testing.
// Real embeddings are 1536 dimensions from OpenAI's text-embedding-3-small model.
// 
// To generate real embeddings:
//   1. Set OPENAI_API_KEY environment variable
//   2. Run: node test/embeddings-generator.js
//   3. Real embeddings will be loaded from embeddings.json
//
// Or generate on-the-fly in tests:
//   const embedding = await generateEmbedding(profile.Text);

// Try to load real embeddings if available
let testProfiles;
let embeddingMeta = null;
try {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const embeddingsPath = path.join(__dirname, 'embeddings.json');
  
  if (fs.existsSync(embeddingsPath)) {
    const embeddingsJson = fs.readFileSync(embeddingsPath, 'utf8');
    const embeddingsFile = JSON.parse(embeddingsJson);
    
    // Extract metadata and data
    embeddingMeta = embeddingsFile.meta;
    testProfiles = embeddingsFile.data;
    
    console.log(`✓ Using real embeddings from ${embeddingMeta.model} (${embeddingMeta.dimensions}D) via ${embeddingMeta.modelProvider}`);
  } else {
    throw new Error('File not found');
  }
} catch (e) {
  // Fall back to simplified embeddings
  console.log('⚠️ Embeddings file not found so tests will fail');
  throw e;
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('P3 - Vector Similarity Foundation', () => {
  
  describe('Embedding Metadata', () => {
    
    it('should have loaded embedding metadata', () => {
      if (embeddingMeta) {
        expect(embeddingMeta).to.have.property('modelProvider');
        expect(embeddingMeta).to.have.property('model');
        console.log(`    ✓ Using embeddings from: ${embeddingMeta.model} (${embeddingMeta.dimensions}D)`);
      } else {
        console.log('    ⚠️ No embedding metadata found (using fallback embeddings)');
      }
    });
  });
  
  describe('Vector Math Functions', () => {
    
    it('should calculate dot product correctly', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(dotProduct(vec1, vec2)).to.equal(32);
    });
    
    it('should throw error for mismatched vector lengths in dot product', () => {
      expect(() => dotProduct([1, 2], [1, 2, 3])).to.throw('Vectors must have same length');
    });
    
    it('should calculate magnitude correctly', () => {
      const vec = [3, 4]; // 3-4-5 triangle
      // sqrt(3^2 + 4^2) = sqrt(9 + 16) = sqrt(25) = 5
      expect(magnitude(vec)).to.equal(5);
    });
    
    it('should calculate unit vector magnitude as 1', () => {
      const unitVec = [1, 0, 0];
      expect(magnitude(unitVec)).to.equal(1);
    });
    
    it('should calculate cosine similarity for identical vectors as 1', () => {
      const vec = [1, 2, 3, 4];
      expect(cosineSimilarity(vec, vec)).to.be.closeTo(1, 0.0001);
    });
    
    it('should calculate cosine similarity for orthogonal vectors as 0', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      expect(cosineSimilarity(vec1, vec2)).to.be.closeTo(0, 0.0001);
    });
    
    it('should calculate cosine similarity for opposite vectors as -1', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      expect(cosineSimilarity(vec1, vec2)).to.be.closeTo(-1, 0.0001);
    });
    
    it('should handle zero vectors gracefully', () => {
      const zero = [0, 0, 0];
      const normal = [1, 2, 3];
      expect(cosineSimilarity(zero, normal)).to.equal(0);
    });
    
    it('should throw error for mismatched vector lengths in cosine similarity', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).to.throw('Vectors must have same length');
    });
  });
  
  describe('Profile Similarity Calculations', () => {
    
    it('should perform complete matching round and display results', () => {
      // Use all available profiles for a real matching scenario
      const allParticipants = Object.values(testProfiles);
      
      console.log('\n  === MATCHING ROUND 1 (Highest Similarity Pairings) ===');
      console.log(`  Total participants: ${allParticipants.length}\n`);
      
      const result = matchParticipants(allParticipants);
      
      // Display all pairs sorted by similarity (highest first)
      const sortedPairs = [...result.pairs].sort((a, b) => b.similarity - a.similarity);
      
      sortedPairs.forEach((pair, index) => {
        const [p1, p2] = pair.participants;
        console.log(`  Pair ${pair.pairNumber}: ${p1.name} ↔ ${p2.name}`);
        console.log(`    Similarity: ${pair.similarity.toFixed(3)}`);
        console.log(`    ${p1.name}: "${p1.profileText.substring(0, 60)}${p1.profileText.length > 60 ? '...' : ''}"`);
        console.log(`    ${p2.name}: "${p2.profileText.substring(0, 60)}${p2.profileText.length > 60 ? '...' : ''}"`);
        console.log('');
      });
      
      // Validate that we have the expected structure
      expect(result.pairs.length).to.be.greaterThan(0);
      expect(result.pairs.length).to.equal(allParticipants.length / 2);
      
      // The highest similarity pair should be quite high
      const highestPair = sortedPairs[0];
      expect(highestPair.similarity).to.be.above(0.7);
      console.log(`  ✓ Highest similarity: ${highestPair.similarity.toFixed(3)} (${highestPair.participants[0].name} ↔ ${highestPair.participants[1].name})`);
      
      // The lowest should still be reasonable (algorithm picked best available)
      const lowestPair = sortedPairs[sortedPairs.length - 1];
      console.log(`  ✓ Lowest similarity: ${lowestPair.similarity.toFixed(3)} (${lowestPair.participants[0].name} ↔ ${lowestPair.participants[1].name})`);
      console.log('  === END ROUND 1 ===\n');
    });
    
    it('should show high similarity between agriculture profiles', () => {
      const sim = cosineSimilarity(
        testProfiles.agriculture1.embedding,
        testProfiles.agriculture2.embedding
      );
      expect(sim).to.be.above(0.79); // Very similar
    });
    
    it('should show high similarity between education profiles', () => {
      const sim = cosineSimilarity(
        testProfiles.homeschool1.embedding,
        testProfiles.teacher1.embedding
      );
      expect(sim).to.be.above(0.6); // Education-related
    });
    
    it('should show high similarity between construction profiles', () => {
      const sim = cosineSimilarity(
        testProfiles.construction1.embedding,
        testProfiles.carpenter1.embedding
      );
      expect(sim).to.be.above(0.4); // Building-related
    });
    
    it('should show high similarity between outdoor adventure profiles', () => {
      const sim = cosineSimilarity(
        testProfiles.hiking1.embedding,
        testProfiles.climber1.embedding
      );
      expect(sim).to.be.above(0.4); // Outdoor activities
    });
    
    it('should show high similarity between tech/software profiles', () => {
      const sim = cosineSimilarity(
        testProfiles.tech.embedding,
        testProfiles.developer1.embedding
      );
      expect(sim).to.be.above(0.5); // Software development
    });
    
    it('should show medium similarity between agriculture and environment', () => {
      // Agriculture and environment should have some overlap
      const sim = cosineSimilarity(
        testProfiles.agriculture1.embedding,
        testProfiles.environment.embedding
      );
      expect(sim).to.be.above(0.4).and.below(0.9);
    });
    
    it('should show medium similarity between community organizing and tech community', () => {
      // Community organizing and tech community should overlap
      const sim = cosineSimilarity(
        testProfiles.community.embedding,
        testProfiles.techCommunity.embedding
      );
      expect(sim).to.be.above(0.5).and.below(0.8);
    });
    
    it('should show low similarity between tech and agriculture', () => {
      // Tech and agriculture should be quite different
      const sim = cosineSimilarity(
        testProfiles.agriculture1.embedding,
        testProfiles.tech.embedding
      );
      expect(sim).to.be.below(0.7);
    });
    
    it('should show low similarity between board games and firearms', () => {
      // Board games and firearms should be very different
      const sim = cosineSimilarity(
        testProfiles.boardgames1.embedding,
        testProfiles.firearms1.embedding
      );
      expect(sim).to.be.below(0.6);
    });
    
    it('should show low similarity between AI research and mushroom cultivation', () => {
      // AI research and mushroom cultivation should be different
      const sim = cosineSimilarity(
        testProfiles.aiResearcher1.embedding,
        testProfiles.mycology1.embedding
      );
      expect(sim).to.be.below(0.6);
    });
    
    it('should work with short tech profiles matching longer tech profiles', () => {
      // Very short profile (Noah: "Full-stack dev. React, Node, Python.")
      // should still match with longer tech profiles
      const sim = cosineSimilarity(
        testProfiles.developer1.embedding,
        testProfiles.aiResearcher1.embedding
      );
      expect(sim).to.be.above(0.35); // Both are software/tech
    });
    
    it('should work with short education profiles matching longer education profiles', () => {
      // Very short education profile should match longer education profiles
      const sim = cosineSimilarity(
        testProfiles.education1.embedding,
        testProfiles.homeschool1.embedding
      );
      expect(sim).to.be.above(0.35);
    });
  });
  
  describe('Basic Pairing Algorithm', () => {
    
    it('should match 4 people into 2 pairs', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      const result = matchParticipants(participants);
      
      expect(result.pairs).to.have.length(2);
      
      // Each pair should have 2 participants
      result.pairs.forEach(pair => {
        expect(pair.participants).to.have.length(2);
        expect(pair.similarity).to.be.a('number');
        expect(pair.pairNumber).to.be.a('number');
      });
    });
    
    it('should pair similar profiles together', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      const result = matchParticipants(participants);
      
      // Find the pair with agriculture1
      const agriculturePair = result.pairs.find(pair =>
        pair.participants.some(p => p.id === 'user-001')
      );
      
      // Agriculture1 should be paired with agriculture2 (highest similarity)
      const partner = agriculturePair.participants.find(p => p.id !== 'user-001');
      expect(partner.id).to.equal('user-002');
      
      // Tech should be paired with techCommunity
      const techPair = result.pairs.find(pair =>
        pair.participants.some(p => p.id === 'user-003')
      );
      const techPartner = techPair.participants.find(p => p.id !== 'user-003');
      expect(techPartner.id).to.equal('user-006');
    });
    
    it('should throw error with odd number of people (5)', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity,
        testProfiles.community
      ];
      
      expect(() => matchParticipants(participants)).to.throw('Need an even number of participants for matching');
    });
    
    it('should handle 26 people with 13 pairs', () => {
      const participants = Object.values(testProfiles);
      
      const result = matchParticipants(participants);
      
      expect(result.pairs).to.have.length(13);
      
      // All participants should be used exactly once
      const usedIds = new Set();
      result.pairs.forEach(pair => {
        pair.participants.forEach(p => {
          expect(usedIds.has(p.id)).to.be.false;
          usedIds.add(p.id);
        });
      });
      expect(usedIds.size).to.equal(26);
    });
    
    it('should assign pair numbers sequentially', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      const result = matchParticipants(participants);
      
      const pairNumbers = result.pairs.map(p => p.pairNumber).sort();
      expect(pairNumbers).to.deep.equal([1, 2]);
    });
  });
  
  describe('Constraint Handling', () => {
    
    it('should exclude specified participant pairs', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      // Exclude agriculture1 and agriculture2 from being paired
      const excludedPairs = [['user-001', 'user-002']];
      
      const result = matchParticipants(participants, excludedPairs);
      
      // Verify agriculture1 and agriculture2 are NOT paired together
      const hasForbiddenPair = result.pairs.some(pair => {
        const ids = pair.participants.map(p => p.id).sort();
        return ids[0] === 'user-001' && ids[1] === 'user-002';
      });
      
      expect(hasForbiddenPair).to.be.false;
    });
    
    it('should exclude specified individuals from matching', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      // Exclude agriculture1 and agriculture2 from matching (e.g., they're organizers)
      const excludedIds = ['user-001', 'user-002'];
      
      const result = matchParticipants(participants, [], excludedIds);
      
      // Should only have 2 people in matching (even number)
      const allParticipants = result.pairs.flatMap(pair => pair.participants);
      
      expect(allParticipants).to.have.length(2);
      expect(allParticipants.some(p => p.id === 'user-001')).to.be.false;
      expect(allParticipants.some(p => p.id === 'user-002')).to.be.false;
    });
    
    it('should prevent repeating pairs from previous rounds', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      // First round
      const round1 = matchParticipants(participants);
      
      // Extract previous pairs
      const previousPairs = round1.pairs.map(pair => 
        pair.participants.map(p => p.id)
      );
      
      // Second round - should not repeat any pairs
      const round2 = matchParticipants(participants, [], [], previousPairs);
      
      // Verify no pairs are repeated
      round2.pairs.forEach(pair => {
        const ids = pair.participants.map(p => p.id).sort();
        const wasInRound1 = previousPairs.some(prevPair => {
          const prevIds = prevPair.sort();
          return prevIds[0] === ids[0] && prevIds[1] === ids[1];
        });
        expect(wasInRound1).to.be.false;
      });
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle minimum 2 people', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.tech
      ];
      
      const result = matchParticipants(participants);
      
      expect(result.pairs).to.have.length(1);
      expect(result.pairs[0].participants).to.have.length(2);
    });
    
    it('should throw error with odd number of people (3)', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.tech,
        testProfiles.community
      ];
      
      expect(() => matchParticipants(participants)).to.throw('Need an even number of participants for matching');
    });
    
    it('should throw error with less than 2 people', () => {
      const participants = [testProfiles.agriculture1];
      
      expect(() => matchParticipants(participants)).to.throw('Need at least 2 participants');
    });
    
    it('should throw error when all pairs are excluded', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.tech
      ];
      
      const excludedPairs = [['user-001', 'user-003']];
      
      expect(() => matchParticipants(participants, excludedPairs))
        .to.throw('No valid pairs available');
    });
    
    it('should handle very similar profiles gracefully', () => {
      // All profiles are identical - any pairing should work
      const identicalProfile = testProfiles.agriculture1;
      const participants = [
        { ...identicalProfile, id: 'dup-001' },
        { ...identicalProfile, id: 'dup-002' },
        { ...identicalProfile, id: 'dup-003' },
        { ...identicalProfile, id: 'dup-004' }
      ];
      
      const result = matchParticipants(participants);
      
      expect(result.pairs).to.have.length(2);
      // All similarities should be ~1.0
      result.pairs.forEach(pair => {
        expect(pair.similarity).to.be.closeTo(1, 0.0001);
      });
    });
  });
  
  describe('Match Quality Verification', () => {
    
    it('should produce higher similarity within pairs than across non-pairs', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.tech,
        testProfiles.techCommunity
      ];
      
      const result = matchParticipants(participants);
      
      // Calculate average similarity within pairs
      const pairSimilarities = result.pairs.map(pair => pair.similarity);
      const avgPairSimilarity = pairSimilarities.reduce((a, b) => a + b, 0) / pairSimilarities.length;
      
      // Calculate average similarity across non-pairs
      const crossSimilarities = [];
      result.pairs.forEach((pair1, i) => {
        result.pairs.forEach((pair2, j) => {
          if (i < j) {
            // Compare participants from different pairs
            pair1.participants.forEach(p1 => {
              pair2.participants.forEach(p2 => {
                crossSimilarities.push(cosineSimilarity(p1.embedding, p2.embedding));
              });
            });
          }
        });
      });
      
      if (crossSimilarities.length > 0) {
        const avgCrossSimilarity = crossSimilarities.reduce((a, b) => a + b, 0) / crossSimilarities.length;
        
        // Within-pair similarity should be higher than cross-pair similarity
        expect(avgPairSimilarity).to.be.above(avgCrossSimilarity);
      }
    });
    
    it('should match similar profiles when even number provided', () => {
      const participants = [
        testProfiles.agriculture1,
        testProfiles.agriculture2,
        testProfiles.environment, // Similar to agriculture profiles
        testProfiles.tech // Different domain
      ];
      
      const result = matchParticipants(participants);
      
      // Should have 2 pairs
      expect(result.pairs).to.have.length(2);
      
      // Agriculture profiles should be paired together due to high similarity
      const agriculturePair = result.pairs.find(pair =>
        pair.participants.some(p => p.id === 'user-001')
      );
      expect(agriculturePair).to.not.be.undefined;
      const agriculturePartner = agriculturePair.participants.find(p => p.id !== 'user-001');
      expect(['user-002', 'user-005']).to.include(agriculturePartner.id);
    });
  });
});
