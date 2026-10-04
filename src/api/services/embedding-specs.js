/**
 * Embedding specs: the versioned definition of an embedding space.
 *
 * Vectors are comparable only when produced under the same spec ID. Changing
 * any field that affects vector values (model, revision, dtype, template,
 * pooling, dimensions, preprocessing) requires a new spec ID.
 *
 * See CHANGE/PLAN-interest-matching-architecture.md section 3.
 */

const GRANITE_311M_R2_Q8_256 = {
  embeddingSpecId: 'match-v1-granite311m-r2-q8-256',
  modelRepo: 'onnx-community/granite-embedding-311m-multilingual-r2-ONNX',
  modelRevision: '8f039f21d4181327268271bea4b11ddcc7eef88d',
  dtype: 'q8', // onnx/model_quantized.onnx
  // sha256 of each file, relative to the model directory; verified before loading
  fileSha256: {
    'onnx/model_quantized.onnx': '54d33d10f865516eda6770d7b0bbf5eaece861058907da0ad095c62e52958c3d',
    'tokenizer.json': '0087c868b33bad550a78a08d19798cfd7f713cde4f020803b8f51f405503e15f',
    'tokenizer_config.json': '7947bdf0378520e69ca412b8c4dacd1cffa8aef099f851fdd5c65aa27c6b36a0',
    'config.json': 'f0a7f93beca7d6ba8728759b9ad5defa80b3e6a4a289a111aec99e1567f2bb18',
  },
  license: 'Apache-2.0',
  inputTemplate: '{text}',
  subjectInputs: {
    profile: '{description}',
    plan: '{name}\n{description}',
    query: '{text}',
  },
  maxInputTokens: 512,
  pooling: 'cls',
  outputDimensions: 768,
  dimensions: 256, // Matryoshka prefix
  normalize: 'l2',
  vectorEncoding: 'float32-le',
  similarity: 'dot',
  // Matching policy for vectors in this space (see matching-engine.js). Similarity
  // scales differ by model, so thresholds live here and not in code. On the
  // evaluation corpus this model averages 0.77 for unrelated pairs and 0.87 for
  // strong ones; a 0.78 cut drops 64% of unrelated pairs and keeps 96% of
  // moderate and 99% of strong ones. Tune against real profiles. Changing
  // these values does not change vectors, so it needs no new spec ID.
  matching: {
    algorithm: 'match-v1',
    minimumSimilarity: 0.78,
    maxMatchesPerChunk: 1,
    topMatchCount: 5,
    weights: { meanTopMatches: 0.5, coverage: 0.3, strongestMatch: 0.2 },
  },
}

const EMBEDDING_SPECS = {
  [GRANITE_311M_R2_Q8_256.embeddingSpecId]: GRANITE_311M_R2_Q8_256,
}

const DEFAULT_EMBEDDING_SPEC_ID = GRANITE_311M_R2_Q8_256.embeddingSpecId

function activeEmbeddingSpec() {
  const specId = process.env.EMBEDDING_SPEC_ID || DEFAULT_EMBEDDING_SPEC_ID
  const spec = EMBEDDING_SPECS[specId]
  if (!spec) {
    throw new Error(`Unknown EMBEDDING_SPEC_ID: ${specId}`)
  }
  return spec
}

module.exports = {
  EMBEDDING_SPECS,
  DEFAULT_EMBEDDING_SPEC_ID,
  activeEmbeddingSpec,
}
