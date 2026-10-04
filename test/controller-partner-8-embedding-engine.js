import chai from "chai";

const fs = require('fs')
const path = require('path')

const engine = require('../src/api/services/embedding-engine')
const { EMBEDDING_SPECS, DEFAULT_EMBEDDING_SPEC_ID, activeEmbeddingSpec } = require('../src/api/services/embedding-specs')

const expect = chai.expect

/**
 * Embedding engine tests.
 *
 * The golden-vector tests load the default spec's model (downloaded into
 * EMBEDDING_MODEL_DIR on first run, ~100 MB) and compare against
 * test/embedding-eval/golden/<specId>.json.
 */

const spec = EMBEDDING_SPECS[DEFAULT_EMBEDDING_SPEC_ID]

function norm(vec) {
  return Math.sqrt(engine.dot(vec, vec))
}

describe('P8 - Embedding Engine: text handling', () => {

  it('preprocessText trims and collapses whitespace', () => {
    expect(engine.preprocessText('  Board   games,\n\n and\tpuzzles!  ')).to.equal('Board games, and puzzles!')
  })

  it('preprocessText maps non-strings and blank text to empty', () => {
    expect(engine.preprocessText(null)).to.equal('')
    expect(engine.preprocessText(undefined)).to.equal('')
    expect(engine.preprocessText(42)).to.equal('')
    expect(engine.preprocessText(' \n\t ')).to.equal('')
  })

  it('subjectText builds plan input from name and description', () => {
    expect(engine.subjectText(spec, 'plan', { name: 'Garden', description: 'Shared beds' })).to.equal('Garden Shared beds')
    expect(engine.subjectText(spec, 'plan', { name: 'Garden', description: '' })).to.equal('Garden')
    expect(engine.subjectText(spec, 'plan', { name: '', description: null })).to.equal('')
  })

  it('subjectText builds profile and query input', () => {
    expect(engine.subjectText(spec, 'profile', { description: ' hi  there ' })).to.equal('hi there')
    expect(engine.subjectText(spec, 'query', { text: 'gardening' })).to.equal('gardening')
  })

  it('subjectText rejects an unknown subject type', () => {
    expect(() => engine.subjectText(spec, 'nonsense', {})).to.throw(/no input for subject type/)
  })

  it('contentHash is a stable sha256 of the preprocessed text', () => {
    const hash = engine.contentHash('gardening')
    expect(hash).to.match(/^[0-9a-f]{64}$/)
    expect(engine.contentHash('gardening')).to.equal(hash)
    expect(engine.contentHash('Gardening')).to.not.equal(hash)
  })

})

describe('P8 - Embedding Engine: vector encoding', () => {

  const vec = Float32Array.from([0.5, -0.25, 1e-7, -3.4028234663852886e38, 0])

  it('round-trips through a float32 little-endian blob exactly', () => {
    const blob = engine.vectorToBlob(vec)
    expect(blob.length).to.equal(vec.length * 4)
    expect(blob.readFloatLE(0)).to.equal(0.5)
    expect(Array.from(engine.blobToVector(blob))).to.deep.equal(Array.from(vec))
  })

  it('round-trips through base64 exactly', () => {
    expect(Array.from(engine.base64ToVector(engine.vectorToBase64(vec)))).to.deep.equal(Array.from(vec))
  })

  it('decodes a blob that is a view into a larger buffer', () => {
    const blob = engine.vectorToBlob(vec)
    const bigger = Buffer.concat([Buffer.from([9, 9, 9]), blob])
    expect(Array.from(engine.blobToVector(bigger.subarray(3)))).to.deep.equal(Array.from(vec))
  })

  it('rejects a blob whose length is not a multiple of 4', () => {
    expect(() => engine.blobToVector(Buffer.alloc(6))).to.throw(/multiple of 4/)
  })

  it('dot rejects vectors of different lengths', () => {
    expect(() => engine.dot([1, 2], [1, 2, 3])).to.throw(/same length/)
  })

})

describe('P8 - Embedding Engine: specs', () => {

  it('has a valid default spec', () => {
    expect(activeEmbeddingSpec().embeddingSpecId).to.equal(DEFAULT_EMBEDDING_SPEC_ID)
    expect(spec.dimensions).to.be.at.most(spec.outputDimensions)
    for (const type of ['profile', 'plan', 'query']) {
      expect(spec.subjectInputs[type]).to.be.a('string')
    }
  })

  it('rejects an unknown EMBEDDING_SPEC_ID', () => {
    const saved = process.env.EMBEDDING_SPEC_ID
    process.env.EMBEDDING_SPEC_ID = 'no-such-spec'
    try {
      expect(() => activeEmbeddingSpec()).to.throw(/Unknown EMBEDDING_SPEC_ID/)
    } finally {
      if (saved === undefined) {
        delete process.env.EMBEDDING_SPEC_ID
      } else {
        process.env.EMBEDDING_SPEC_ID = saved
      }
    }
  })

})

describe('P8 - Embedding Engine: model output', function () {
  this.timeout(300000) // first run downloads the model

  const goldenPath = path.join(__dirname, 'embedding-eval', 'golden', `${spec.embeddingSpecId}.json`)
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
  let vectors

  before(async () => {
    vectors = await engine.embedTexts(spec, golden.cases.map((c) => c.input))
  })

  it('golden inputs still preprocess and hash the same way', () => {
    for (const c of golden.cases) {
      const input = engine.subjectText(spec, c.subjectType, c.fields)
      expect(input).to.equal(c.input)
      expect(engine.contentHash(input)).to.equal(c.contentHash)
    }
  })

  it('produces normalized vectors of the spec dimensions', () => {
    for (const vec of vectors) {
      expect(vec.length).to.equal(spec.dimensions)
      expect(norm(vec)).to.be.closeTo(1, 1e-5)
    }
  })

  it('reproduces the golden vectors', () => {
    golden.cases.forEach((c, i) => {
      const similarity = engine.dot(vectors[i], engine.base64ToVector(c.vector))
      expect(similarity, `case ${i}: ${c.input.slice(0, 40)}`).to.be.above(0.9999)
    })
  })

  it('gives the same vector regardless of batch composition', async () => {
    const [alone] = await engine.embedTexts(spec, [golden.cases[1].input])
    expect(engine.dot(alone, vectors[1])).to.be.above(0.9999)
  })

  it('truncates long input at maxInputTokens', async () => {
    const longCase = golden.cases.find((c) => c.input.endsWith('I keep honeybees.'))
    const withoutTail = longCase.input.replace(/At the very end: I keep honeybees\.$/, 'At the very end: I collect stamps.')
    const [full] = await engine.embedTexts(spec, [longCase.input])
    const [altered] = await engine.embedTexts(spec, [withoutTail])
    // the differing last sentence lies past the token limit, so both embed the same tokens
    expect(engine.dot(full, altered)).to.be.above(0.9999)
  })

  it('rejects empty input', async () => {
    let error
    try {
      await engine.embedTexts(spec, ['ok', ''])
    } catch (e) {
      error = e
    }
    expect(error && error.message).to.match(/Cannot embed empty text/)
  })

  it('reduces dimensions by prefix and re-normalizes', async () => {
    const reducedSpec = { ...spec, embeddingSpecId: `${spec.embeddingSpecId}-test-128`, dimensions: 128, fileSha256: null }
    const [reduced] = await engine.embedTexts(reducedSpec, [golden.cases[0].input])
    expect(reduced.length).to.equal(128)
    expect(norm(reduced)).to.be.closeTo(1, 1e-5)
    const prefix = vectors[0].slice(0, 128)
    const prefixNorm = norm(prefix)
    for (let i = 0; i < 128; i++) {
      expect(reduced[i]).to.be.closeTo(prefix[i] / prefixNorm, 1e-5)
    }
  })

  it('ranks the golden gardening query closest to the garden plan', () => {
    const query = golden.cases.findIndex((c) => c.input === 'vegetable gardening')
    const scores = golden.cases.map((c, i) => (i === query ? -1 : engine.dot(vectors[query], vectors[i])))
    const best = scores.indexOf(Math.max(...scores))
    expect(golden.cases[best].input).to.match(/Community Garden/)
  })

})
