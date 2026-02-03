/**
 * Matching service - vector similarity and pairing algorithm for profile matching.
 * Uses cosine similarity and greedy pairing to maximize total similarity.
 */

const { storageStringToEmbedding } = require('./embeddings.service');

/**
 * Calculate dot product of two vectors
 */
function dotProduct(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }
  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

/**
 * Calculate magnitude (length) of a vector
 */
function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 (opposite) and 1 (identical)
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

/**
 * Create pairs from participants based on similarity scores.
 * Uses greedy algorithm: sort all pairs by similarity descending, then pick non-overlapping pairs.
 *
 * @param {Array<{issuerDid: string, embedding: number[]}>} participants - Participants with embeddings
 * @param {string[]} excludedDids - issuerDids to exclude from matching
 * @param {Array<[string, string]>} excludedPairDids - Pairs of issuerDids to never match
 * @param {Array<[string, string]>} previousPairDids - Pairs of issuerDids from previous rounds (don't repeat)
 * @returns {{ pairs: Array<{participants: Array, similarity: number, pairNumber: number}> }}
 */
function matchParticipants(participants, excludedDids = [], excludedPairDids = [], previousPairDids = []) {
  const available = participants.filter((p) => !excludedDids.includes(p.issuerDid));

  if (available.length < 2) {
    throw new Error('Need at least 2 participants for matching');
  }

  if (available.length % 2 !== 0) {
    throw new Error('Need an even number of participants for matching');
  }

  const similarities = [];
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const p1 = available[i];
      const p2 = available[j];

      const isExcluded = excludedPairDids.some(
        ([did1, did2]) =>
          (did1 === p1.issuerDid && did2 === p2.issuerDid) || (did1 === p2.issuerDid && did2 === p1.issuerDid)
      );

      const wasPreviouslyPaired = previousPairDids.some(
        ([did1, did2]) =>
          (did1 === p1.issuerDid && did2 === p2.issuerDid) || (did1 === p2.issuerDid && did2 === p1.issuerDid)
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

  similarities.sort((a, b) => b.similarity - a.similarity);

  const pairs = [];
  const used = new Set();

  for (const { p1, p2, similarity } of similarities) {
    if (!used.has(p1.issuerDid) && !used.has(p2.issuerDid)) {
      pairs.push({
        participants: [p1, p2],
        similarity,
        pairNumber: pairs.length + 1,
      });
      used.add(p1.issuerDid);
      used.add(p2.issuerDid);
    }
  }

  return { pairs };
}

/**
 * Build participant objects with embeddings from DB rows.
 * @param {Array<{rowId: number, issuerDid: string, description: string, embeddingVector: string}>} rows
 * @returns {Array<{id: string, embedding: number[], issuerDid: string, description: string}>}
 */
function buildParticipantsFromRows(rows) {
  return rows.map((row) => {
    const embedding = storageStringToEmbedding(row.embeddingVector);
    if (!embedding || embedding.length === 0) {
      throw new Error(`Invalid embedding for profile ${row.rowId}`);
    }
    return {
      id: row.issuerDid,
      issuerDid: row.issuerDid,
      description: row.description,
      embedding,
    };
  });
}

module.exports = {
  dotProduct,
  magnitude,
  cosineSimilarity,
  matchParticipants,
  buildParticipantsFromRows,
};
