/**
 * Matching service - pairing algorithm for meeting (group onboarding) matching.
 * Scores come from matching-engine.js; pairing is greedy by similarity.
 */

const { compare } = require('./matching-engine');

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

function samePair(p1, p2, [did1, did2]) {
  return (did1 === p1.issuerDid && did2 === p2.issuerDid) || (did1 === p2.issuerDid && did2 === p1.issuerDid);
}

/**
 * Create pairs from participants based on similarity scores.
 *
 * Greedy: sort all allowed pairs of participants who have vectors by
 * similarity descending, then pick non-overlapping pairs. Participants left
 * over (those without vectors, and any the scored pass couldn't place) are
 * then paired in order; a pair's similarity is null when either side has no vector.
 *
 * @param {Array<{issuerDid: string, vectors: Array<Float32Array|number[]>}>} participants - vectors may be empty
 * @param {object} matchingSpec - the 'matching' object of the embedding spec
 * @param {string[]} excludedDids - issuerDids to exclude from matching
 * @param {Array<[string, string]>} excludedPairDids - Pairs of issuerDids to never match
 * @param {Array<[string, string]>} previousPairDids - Pairs of issuerDids from previous rounds (don't repeat)
 * @returns {{ pairs: Array<{participants: Array, similarity: number|null, pairNumber: number}> }}
 */
function matchParticipants(participants, matchingSpec, excludedDids = [], excludedPairDids = [], previousPairDids = []) {
  const available = participants.filter((p) => !excludedDids.includes(p.issuerDid));

  if (available.length < 2) {
    throw new Error('You need at least 2 participants for matching.');
  }

  if (available.length % 2 !== 0) {
    throw new Error('You need an even number of participants for matching.');
  }

  const isAllowed = (p1, p2) =>
    !excludedPairDids.some((pair) => samePair(p1, p2, pair))
    && !previousPairDids.some((pair) => samePair(p1, p2, pair));

  const scored = available.filter((p) => p.vectors && p.vectors.length > 0);
  const similarities = [];
  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const p1 = scored[i];
      const p2 = scored[j];
      if (isAllowed(p1, p2)) {
        const similarity = compare(p1.vectors, p2.vectors, matchingSpec).score;
        similarities.push({ p1, p2, similarity });
      }
    }
  }
  similarities.sort((a, b) => b.similarity - a.similarity);

  const pairs = [];
  const used = new Set();
  const addPair = (p1, p2, similarity) => {
    pairs.push({ participants: [p1, p2], similarity, pairNumber: pairs.length + 1 });
    used.add(p1.issuerDid);
    used.add(p2.issuerDid);
  };

  for (const { p1, p2, similarity } of similarities) {
    if (!used.has(p1.issuerDid) && !used.has(p2.issuerDid)) {
      addPair(p1, p2, similarity);
    }
  }

  const leftover = available.filter((p) => !used.has(p.issuerDid));
  for (let i = 0; i < leftover.length; i++) {
    for (let j = i + 1; j < leftover.length && !used.has(leftover[i].issuerDid); j++) {
      const [p1, p2] = [leftover[i], leftover[j]];
      if (!used.has(p2.issuerDid) && isAllowed(p1, p2)) {
        const bothScored = p1.vectors && p1.vectors.length > 0 && p2.vectors && p2.vectors.length > 0;
        addPair(p1, p2, bothScored ? compare(p1.vectors, p2.vectors, matchingSpec).score : null);
      }
    }
  }

  if (pairs.length === 0) {
    throw new Error('No more valid pairs are available. Erase previous matches and start over.');
  }

  return { pairs };
}

module.exports = {
  dotProduct,
  magnitude,
  cosineSimilarity,
  matchParticipants,
};
