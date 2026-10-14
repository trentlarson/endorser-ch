/**
 * Matching engine: scores subjects against each other from their vectors.
 *
 * No storage, model, or other module dependencies, so the same file can run in
 * clients and peers. Vectors must come from one embedding spec, and are
 * L2-normalized, so the dot product is the cosine similarity.
 *
 * See CHANGE/PLAN-interest-matching-architecture.md section 6.
 */

/**
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number}
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have same length (${a.length} vs ${b.length})`)
  }
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i]
  }
  return sum
}

/**
 * Compare two subjects, each given as its chunk vectors.
 *
 * With one vector on each side the score is their dot product. With several,
 * chunks are paired one-to-one by best similarity, pairs under
 * matchingSpec.minimumSimilarity are dropped, and the score combines the mean
 * of the top matches, the coverage (matched chunks over the smaller side's
 * chunk count), and the strongest match.
 *
 * @param {Array<Float32Array|number[]>} vectorsA
 * @param {Array<Float32Array|number[]>} vectorsB
 * @param {object} matchingSpec - the 'matching' object of an embedding spec
 * @returns {{ score: number, evidence: Array<{ chunkA: number, chunkB: number, similarity: number }> }}
 */
function compare(vectorsA, vectorsB, matchingSpec) {
  if (vectorsA.length === 0 || vectorsB.length === 0) {
    return { score: 0, evidence: [] }
  }
  if (vectorsA.length === 1 && vectorsB.length === 1) {
    const similarity = dot(vectorsA[0], vectorsB[0])
    return { score: similarity, evidence: [{ chunkA: 0, chunkB: 0, similarity }] }
  }

  const candidates = []
  for (let i = 0; i < vectorsA.length; i++) {
    for (let j = 0; j < vectorsB.length; j++) {
      const similarity = dot(vectorsA[i], vectorsB[j])
      if (similarity >= matchingSpec.minimumSimilarity) {
        candidates.push({ chunkA: i, chunkB: j, similarity })
      }
    }
  }
  candidates.sort((x, y) => y.similarity - x.similarity)

  const maxPerChunk = matchingSpec.maxMatchesPerChunk || 1
  const usedA = new Map()
  const usedB = new Map()
  const evidence = []
  for (const c of candidates) {
    if ((usedA.get(c.chunkA) || 0) < maxPerChunk && (usedB.get(c.chunkB) || 0) < maxPerChunk) {
      evidence.push(c)
      usedA.set(c.chunkA, (usedA.get(c.chunkA) || 0) + 1)
      usedB.set(c.chunkB, (usedB.get(c.chunkB) || 0) + 1)
    }
  }
  if (evidence.length === 0) {
    return { score: 0, evidence }
  }

  const top = evidence.slice(0, matchingSpec.topMatchCount)
  const meanTopMatches = top.reduce((sum, e) => sum + e.similarity, 0) / top.length
  const coverage = Math.min(usedA.size, usedB.size) / Math.min(vectorsA.length, vectorsB.length)
  const strongestMatch = evidence[0].similarity
  const w = matchingSpec.weights
  const score = w.meanTopMatches * meanTopMatches + w.coverage * coverage + w.strongestMatch * strongestMatch
  return { score, evidence }
}

/**
 * Rank candidates by similarity to a source.
 *
 * @param {Array<Float32Array|number[]>} sourceVectors
 * @param {Array<{ id: *, vectors: Array<Float32Array|number[]> }>} candidates
 * @param {object} matchingSpec
 * @param {{ minSimilarity?: number, limit?: number }} options - minSimilarity defaults to matchingSpec.minimumSimilarity
 * @returns {Array<{ id: *, score: number, evidence: Array }>} best first
 */
function rank(sourceVectors, candidates, matchingSpec, options = {}) {
  const minSimilarity = options.minSimilarity ?? matchingSpec.minimumSimilarity
  const results = []
  for (const candidate of candidates) {
    const { score, evidence } = compare(sourceVectors, candidate.vectors, matchingSpec)
    if (score >= minSimilarity) {
      results.push({ id: candidate.id, score, evidence })
    }
  }
  results.sort((x, y) => y.score - x.score)
  return options.limit == null ? results : results.slice(0, options.limit)
}

module.exports = {
  dot,
  compare,
  rank,
}
