/**
 * Candidate embedding specs for evaluation. Same shape as
 * src/api/services/embedding-specs.js; the default production spec is included
 * from there so the evaluation exercises exactly what ships.
 *
 * downloadMB is the ONNX weight file(s) for the dtype, from the Hugging Face listing.
 */

const { EMBEDDING_SPECS, DEFAULT_EMBEDDING_SPEC_ID } = require('../../src/api/services/embedding-specs')

const SUBJECT_INPUTS = {
  profile: '{description}',
  plan: '{name}\n{description}',
  query: '{text}',
}

const COMMON = {
  subjectInputs: SUBJECT_INPUTS,
  maxInputTokens: 512,
  normalize: 'l2',
  vectorEncoding: 'float32-le',
  similarity: 'dot',
}

const defaultSpec = EMBEDDING_SPECS[DEFAULT_EMBEDDING_SPEC_ID]

const GRANITE_97M = {
  ...COMMON,
  modelRepo: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX',
  modelRevision: '536a9f241cb3f02a9c5995a1e708c784bd274859',
  license: 'Apache-2.0',
  inputTemplate: '{text}',
  pooling: 'cls',
  outputDimensions: 384,
  dimensions: 384,
  languages: '200+ (52 enhanced)',
}

const CANDIDATES = [
  { ...defaultSpec, downloadMB: 313, languages: '200+ (52 enhanced)' },
  {
    ...defaultSpec,
    embeddingSpecId: 'eval-granite311m-r2-q8-768',
    dimensions: 768,
    downloadMB: 313,
    languages: '200+ (52 enhanced)',
    note: 'full width of the default model',
  },
  { ...GRANITE_97M, embeddingSpecId: 'eval-granite97m-r2-q8-384', dtype: 'q8', downloadMB: 98 },
  {
    ...GRANITE_97M,
    embeddingSpecId: 'eval-granite97m-r2-fp32-384',
    dtype: 'fp32',
    downloadMB: 390,
    note: 'full precision; measures quantization loss',
  },
  {
    ...COMMON,
    embeddingSpecId: 'eval-me5small-q8-384',
    modelRepo: 'Xenova/multilingual-e5-small',
    modelRevision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
    dtype: 'q8',
    license: 'MIT',
    inputTemplate: 'query: {text}',
    pooling: 'mean',
    outputDimensions: 384,
    dimensions: 384,
    downloadMB: 118,
    languages: '~100',
  },
  {
    ...COMMON,
    embeddingSpecId: 'eval-paraphrase-mminilm-l12-q8-384',
    modelRepo: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    modelRevision: '2c4055b12046f11709e9df2c122e59ffbdc2f900',
    dtype: 'q8',
    license: 'Apache-2.0',
    inputTemplate: '{text}',
    maxInputTokens: 128,
    pooling: 'mean',
    outputDimensions: 384,
    dimensions: 384,
    downloadMB: 118,
    languages: '50+',
  },
  {
    ...COMMON,
    embeddingSpecId: 'eval-arctic-m-v2-q8-256',
    modelRepo: 'Snowflake/snowflake-arctic-embed-m-v2.0',
    modelRevision: '95c2741480856aa9666782eb4afe11959938017f',
    dtype: 'q8',
    license: 'Apache-2.0',
    inputTemplate: 'query: {text}',
    pooling: 'cls',
    outputDimensions: 768,
    dimensions: 256,
    downloadMB: 311,
    languages: '~74 (multilingual retrieval)',
  },
  {
    ...COMMON,
    embeddingSpecId: 'eval-minilm-l6-q8-384',
    modelRepo: 'Xenova/all-MiniLM-L6-v2',
    modelRevision: '751bff37182d3f1213fa05d7196b954e230abad9',
    dtype: 'q8',
    license: 'Apache-2.0',
    inputTemplate: '{text}',
    maxInputTokens: 256,
    pooling: 'mean',
    outputDimensions: 384,
    dimensions: 384,
    downloadMB: 23,
    languages: 'English',
    note: 'English-only baseline',
  },
  {
    ...COMMON,
    embeddingSpecId: 'eval-gemma300m-q8-256',
    modelRepo: 'onnx-community/embeddinggemma-300m-ONNX',
    modelRevision: '5090578d9565bb06545b4552f76e6bc2c93e4a66',
    dtype: 'q8',
    license: 'Gemma Terms of Use',
    inputTemplate: 'task: sentence similarity | query: {text}',
    pooling: 'sentence_embedding',
    outputDimensions: 768,
    dimensions: 256,
    downloadMB: 309,
    languages: '100+',
    note: 'reference only; excluded by license',
  },
]

module.exports = { CANDIDATES }
