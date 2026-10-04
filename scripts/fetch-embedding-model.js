/**
 * Put the active embedding spec's pinned model files into EMBEDDING_MODEL_DIR:
 * download each missing or mismatched file, streaming it to disk while
 * checking its sha256, then embed one test text, loading the model the way the
 * server does (local files only), to confirm the runtime works on this platform.
 *
 * Usage:
 *   EMBEDDING_MODEL_DIR=/path/to/models npm run embedding:fetch-model
 *   EMBEDDING_MODEL_DIR=/path/to/models npm run embedding:fetch-model -- --skip-test
 *
 * Downloading and verifying use little memory. The test loads the model, which
 * takes as much memory as the server needs for it (about 1 GB on Linux for the
 * default spec), so --skip-test lets the files be fetched on a host that can't spare
 * that at the moment, eg. while the previous server version is still running.
 */

const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')

// the test below must load exactly as the server does in production
process.env.EMBEDDING_ALLOW_REMOTE_MODELS = 'false'

const engine = require('../src/api/services/embedding-engine')
const { activeEmbeddingSpec } = require('../src/api/services/embedding-specs')

/**
 * Download one file to a temporary name, then move it into place only if its hash matches.
 */
async function download(url, filePath, expectedSha256) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download of ${url} failed: ${response.status} ${response.statusText}`)
  }
  const partial = `${filePath}.partial`
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial))
  const actual = await engine.fileSha256(partial)
  if (actual !== expectedSha256) {
    fs.unlinkSync(partial)
    throw new Error(`Downloaded ${url} has sha256 ${actual} but the spec requires ${expectedSha256}`)
  }
  fs.renameSync(partial, filePath)
}

async function main() {
  const spec = activeEmbeddingSpec()
  const dir = engine.modelDir(spec)
  const baseUrl = `https://huggingface.co/${spec.modelRepo}/resolve/${spec.modelRevision}/`
  for (const [file, expected] of Object.entries(spec.fileSha256)) {
    const filePath = path.join(dir, file)
    if (fs.existsSync(filePath) && (await engine.fileSha256(filePath)) === expected) {
      console.log(`  verified    ${file}`)
    } else {
      console.log(`  downloading ${file} ...`)
      await download(baseUrl + file, filePath, expected)
      console.log(`  downloaded and verified ${file}`)
    }
  }
  console.log(`Model files for ${spec.embeddingSpecId} are in place:\n  ${dir}`)

  if (process.argv.includes('--skip-test')) {
    return
  }
  const started = Date.now()
  const [vector] = await engine.embedTexts(spec, [engine.subjectText(spec, 'query', { text: 'community garden' })])
  if (vector.length !== spec.dimensions) {
    throw new Error(`Expected ${spec.dimensions} dimensions but got ${vector.length}`)
  }
  const rssMB = Math.round(process.memoryUsage().rss / 1e6)
  console.log(`Test embedding succeeded (${Date.now() - started} ms, ${rssMB} MB resident).`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
