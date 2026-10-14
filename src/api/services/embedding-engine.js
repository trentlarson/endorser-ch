/**
 * Embedding engine: turns text into vectors according to an embedding spec
 * (see embedding-specs.js). Independent of storage and of matching.
 *
 * Everything that affects vector values is driven by the spec: text
 * preprocessing, input template, token limit, pooling, dimension reduction,
 * and normalization. The same steps are meant to run in clients.
 */

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_MODEL_DIR = path.join(os.homedir(), '.cache', 'endorser-embedding-models')

// specId -> Promise<{ tokenizer, model }>
const loadedModels = new Map()

let transformersPromise = null
function transformers() {
  if (!transformersPromise) {
    transformersPromise = Promise.resolve().then(() => {
      const lib = require('@huggingface/transformers')
      lib.env.cacheDir = process.env.EMBEDDING_MODEL_DIR || DEFAULT_MODEL_DIR
      // Production should set EMBEDDING_ALLOW_REMOTE_MODELS=false and ship the artifact.
      lib.env.allowRemoteModels = process.env.EMBEDDING_ALLOW_REMOTE_MODELS !== 'false'
      return lib
    })
  }
  return transformersPromise
}

/**
 * Normalize user text before hashing and embedding.
 * @param {string} text
 * @returns {string} trimmed text with whitespace runs collapsed; '' when no content
 */
function preprocessText(text) {
  if (typeof text !== 'string') {
    return ''
  }
  return text.replace(/\s+/g, ' ').trim()
}

function fillTemplate(template, fields) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (fields[key] == null ? '' : String(fields[key])))
}

/**
 * Build the preprocessed input text for a subject (before the model template).
 * @param {object} spec - embedding spec
 * @param {string} subjectType - 'profile' | 'plan' | 'query'
 * @param {object} fields - eg. { description } or { name, description } or { text }
 * @returns {string} '' when the subject has no content
 */
function subjectText(spec, subjectType, fields) {
  const template = spec.subjectInputs[subjectType]
  if (!template) {
    throw new Error(`Spec ${spec.embeddingSpecId} has no input for subject type ${subjectType}`)
  }
  return preprocessText(fillTemplate(template, fields))
}

/**
 * @param {string} preprocessed - output of preprocessText or subjectText
 * @returns {string} hex sha256
 */
function contentHash(preprocessed) {
  return crypto.createHash('sha256').update(preprocessed, 'utf8').digest('hex')
}

/**
 * @returns {string} the directory holding the spec's model files
 */
function modelDir(spec) {
  return path.join(process.env.EMBEDDING_MODEL_DIR || DEFAULT_MODEL_DIR, spec.modelRepo, spec.modelRevision)
}

/**
 * sha256 of a file, read in chunks so a large model file isn't held in memory.
 * @returns {Promise<string>} hex digest
 */
function fileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

/**
 * Check the downloaded or vendored model files against spec.fileSha256.
 * Files live under EMBEDDING_MODEL_DIR/<modelRepo>/<modelRevision>/.
 */
async function verifyModelFiles(spec, cacheDir) {
  if (!spec.fileSha256) {
    return
  }
  const modelDir = path.join(cacheDir, spec.modelRepo, spec.modelRevision)
  for (const [file, expected] of Object.entries(spec.fileSha256)) {
    const filePath = path.join(modelDir, file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Embedding model file missing for ${spec.embeddingSpecId}: ${filePath}`)
    }
    const actual = await fileSha256(filePath)
    if (actual !== expected) {
      throw new Error(`Embedding model file ${filePath} has sha256 ${actual} but spec ${spec.embeddingSpecId} requires ${expected}`)
    }
  }
}

async function loadModel(spec) {
  if (!loadedModels.has(spec.embeddingSpecId)) {
    const promise = transformers().then(async (lib) => {
      // Without remote models, load straight from the spec's directory, verified first:
      // transformers.js keys its cache differently from its local-path lookup, so
      // a repo ID with remote models disabled never finds the cached files.
      const localOnly = !lib.env.allowRemoteModels
      if (localOnly) {
        await verifyModelFiles(spec, lib.env.cacheDir)
      }
      const source = localOnly ? modelDir(spec) : spec.modelRepo
      const options = localOnly ? {} : { revision: spec.modelRevision }
      const tokenizer = await lib.AutoTokenizer.from_pretrained(source, options)
      const model = await lib.AutoModel.from_pretrained(source, { ...options, dtype: spec.dtype })
      if (!localOnly) {
        await verifyModelFiles(spec, lib.env.cacheDir)
      }
      return { tokenizer, model }
    })
    // allow a retry after a failed load
    promise.catch(() => loadedModels.delete(spec.embeddingSpecId))
    loadedModels.set(spec.embeddingSpecId, promise)
  }
  return loadedModels.get(spec.embeddingSpecId)
}

function pool(spec, output, attentionMask) {
  if (spec.pooling === 'sentence_embedding') {
    const tensor = output.sentence_embedding
    const [batch, width] = tensor.dims
    return Array.from({ length: batch }, (unused, b) => Float32Array.from(tensor.data.subarray(b * width, (b + 1) * width)))
  }
  // most exports name the per-token output last_hidden_state; sentence-transformers exports use token_embeddings
  const hidden = output.last_hidden_state || output.token_embeddings
  if (!hidden) {
    throw new Error(`Model for spec ${spec.embeddingSpecId} has no per-token output; outputs: ${Object.keys(output).join(', ')}`)
  }
  const [batch, seqLen, width] = hidden.dims
  const data = hidden.data
  const mask = attentionMask.data
  const vectors = []
  for (let b = 0; b < batch; b++) {
    const vec = new Float32Array(width)
    if (spec.pooling === 'cls') {
      vec.set(data.subarray(b * seqLen * width, b * seqLen * width + width))
    } else if (spec.pooling === 'mean') {
      let count = 0
      for (let t = 0; t < seqLen; t++) {
        if (Number(mask[b * seqLen + t]) === 1) {
          count++
          const offset = (b * seqLen + t) * width
          for (let d = 0; d < width; d++) {
            vec[d] += data[offset + d]
          }
        }
      }
      for (let d = 0; d < width; d++) {
        vec[d] /= Math.max(count, 1)
      }
    } else {
      throw new Error(`Unknown pooling ${spec.pooling} in spec ${spec.embeddingSpecId}`)
    }
    vectors.push(vec)
  }
  return vectors
}

/**
 * Keep the first spec.dimensions values (Matryoshka prefix), then L2-normalize.
 */
function reduceAndNormalize(spec, vec) {
  const reduced = vec.length === spec.dimensions ? vec : vec.slice(0, spec.dimensions)
  let sumSquares = 0
  for (let i = 0; i < reduced.length; i++) {
    sumSquares += reduced[i] * reduced[i]
  }
  const norm = Math.sqrt(sumSquares)
  if (norm > 0) {
    for (let i = 0; i < reduced.length; i++) {
      reduced[i] /= norm
    }
  }
  return reduced
}

/**
 * Embed already-preprocessed, non-empty texts.
 *
 * Texts run one per inference, never batched: quantized models compute
 * activation scales over the whole input tensor, so a batch's padding and
 * neighbors change each vector (measured: 0.98 similarity between a text
 * embedded alone and the same text in a padded batch).
 *
 * @param {object} spec - embedding spec
 * @param {string[]} texts - outputs of subjectText; must be non-empty
 * @returns {Promise<Float32Array[]>} normalized vectors of length spec.dimensions
 */
async function embedTexts(spec, texts) {
  if (texts.some((t) => typeof t !== 'string' || t === '')) {
    throw new Error('Cannot embed empty text; empty subjects have no vector.')
  }
  const { tokenizer, model } = await loadModel(spec)
  const results = []
  for (const text of texts) {
    const inputs = tokenizer([fillTemplate(spec.inputTemplate, { text })], { truncation: true, max_length: spec.maxInputTokens })
    const output = await model(inputs)
    results.push(reduceAndNormalize(spec, pool(spec, output, inputs.attention_mask)[0]))
  }
  return results
}

/**
 * Dot product; equals cosine similarity for normalized vectors.
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
 * @param {Float32Array} vec
 * @returns {Buffer} float32 little-endian bytes
 */
function vectorToBlob(vec) {
  const buf = Buffer.alloc(vec.length * 4)
  for (let i = 0; i < vec.length; i++) {
    buf.writeFloatLE(vec[i], i * 4)
  }
  return buf
}

/**
 * @param {Buffer|Uint8Array} blob - float32 little-endian bytes
 * @returns {Float32Array}
 */
function blobToVector(blob) {
  const buf = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength)
  if (buf.length % 4 !== 0) {
    throw new Error(`Vector blob length ${buf.length} is not a multiple of 4`)
  }
  const vec = new Float32Array(buf.length / 4)
  for (let i = 0; i < vec.length; i++) {
    vec[i] = buf.readFloatLE(i * 4)
  }
  return vec
}

function vectorToBase64(vec) {
  return vectorToBlob(vec).toString('base64')
}

function base64ToVector(str) {
  return blobToVector(Buffer.from(str, 'base64'))
}

module.exports = {
  modelDir,
  fileSha256,
  preprocessText,
  subjectText,
  contentHash,
  embedTexts,
  dot,
  vectorToBlob,
  blobToVector,
  vectorToBase64,
  base64ToVector,
}
