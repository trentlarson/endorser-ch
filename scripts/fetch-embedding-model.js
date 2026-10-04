/**
 * Download the active embedding spec's pinned model files into
 * EMBEDDING_MODEL_DIR, verify their sha256 hashes, and embed one test text to
 * confirm the ONNX runtime works on this platform. Does nothing but verify
 * when the files are already present.
 *
 * Usage:
 *   EMBEDDING_MODEL_DIR=/path/to/models npm run embedding:fetch-model
 *
 * The server itself should run with EMBEDDING_ALLOW_REMOTE_MODELS=false so it
 * only ever loads what this script put in place.
 */

// this script is the one place that downloads
process.env.EMBEDDING_ALLOW_REMOTE_MODELS = 'true'

const engine = require('../src/api/services/embedding-engine')
const { activeEmbeddingSpec } = require('../src/api/services/embedding-specs')

async function main() {
  const spec = activeEmbeddingSpec()
  const started = Date.now()
  const [vector] = await engine.embedTexts(spec, [engine.subjectText(spec, 'query', { text: 'community garden' })])
  if (vector.length !== spec.dimensions) {
    throw new Error(`Expected ${spec.dimensions} dimensions but got ${vector.length}`)
  }
  console.log(`Model for ${spec.embeddingSpecId} is in place and verified (${Date.now() - started} ms):`)
  console.log(`  ${engine.modelDir(spec)}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
