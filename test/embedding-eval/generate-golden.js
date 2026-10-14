/**
 * Generate the golden vectors for an embedding spec: fixed input strings and
 * the vectors this server produces for them. Other runtimes (browser,
 * Capacitor, peers) prove conformance by reproducing these within tolerance;
 * the engine tests use them to detect drift from dependency upgrades.
 *
 * Usage (from the repo root):
 *   pkgx node test/embedding-eval/generate-golden.js [specId]
 *
 * Writes test/embedding-eval/golden/<specId>.json. Regenerate only when
 * deliberately creating a spec; a changed vector for an existing spec is a bug.
 */

const fs = require('fs')
const path = require('path')

const engine = require('../../src/api/services/embedding-engine')
const { EMBEDDING_SPECS, DEFAULT_EMBEDDING_SPEC_ID } = require('../../src/api/services/embedding-specs')

const LONG_TEXT = `${'I like long walks and quiet evenings with a good book. '.repeat(80)}At the very end: I keep honeybees.`

const INPUTS = [
  ['profile', { description: 'Passionate about sustainable agriculture, permaculture design, and regenerative farming practices' }],
  ['profile', { description: 'Full-stack dev. React, Node, Python.' }],
  ['profile', { description: 'I breed ball pythons and corn snakes and teach reptile husbandry at the local pet expo.' }],
  ['profile', { description: 'Tengo un huerto comunitario en mi barrio y me encanta compartir semillas y cosechas con los vecinos.' }],
  ['profile', { description: 'Marceneiro há vinte anos. Faço móveis sob medida com madeira de demolição.' }],
  ['profile', { description: "Grimpeuse passionnée, je fais de l'escalade en falaise et de l'alpinisme l'été." }],
  ['profile', { description: 'Softwareentwickler mit Schwerpunkt auf Open-Source-Projekten und dezentralen Netzwerken.' }],
  ['profile', { description: 'きのこ栽培が趣味です。自宅でシイタケやヒラタケを育てています。' }],
  ['profile', { description: 'Mimi ni mkulima wa mboga na matunda. Ninapenda kilimo hai.' }],
  ['profile', { description: '我是桌游爱好者，每周在家里组织桌游之夜。' }],
  ['profile', { description: 'معلمة في مدرسة ابتدائية، أهتم بالتعليم القائم على المشاريع.' }],
  ['profile', { description: 'मैं बास्केटबॉल कोच हूँ और बच्चों को खेल सिखाना पसंद करता हूँ।' }],
  ['profile', { description: 'Аналитик данных. Люблю визуализацию.' }],
  ['profile', { description: 'Soy developer full-stack, trabajo con React y Node. Also into bouldering los fines de semana.' }],
  ['profile', { description: '  Board   games,\n\n and\tpuzzles!  ' }],
  ['profile', { description: '🐝🌻 beekeeping & gardening 🌱' }],
  ['profile', { description: 'x' }],
  ['profile', { description: LONG_TEXT }],
  ['plan', { name: 'Riverside Community Garden', description: 'Shared vegetable beds with a seed library and monthly compost workshops.' }],
  ['plan', { name: 'Timber Frame Barn Raising', description: 'Help raise a traditional mortise-and-tenon barn.' }],
  ['plan', { name: 'Mutual Aid Mobile App', description: '' }],
  ['plan', { name: '', description: 'Planting 2,000 native saplings to restore riparian habitat.' }],
  ['plan', { name: '里山の登山道整備', description: '週末に地域の登山道を整備するボランティア活動です。' }],
  ['query', { text: 'vegetable gardening' }],
  ['query', { text: 'clases de carpintería' }],
  ['query', { text: 'python programming' }],
  ['query', { text: 'ボードゲーム' }],
]

async function main() {
  const specId = process.argv[2] || DEFAULT_EMBEDDING_SPEC_ID
  const spec = EMBEDDING_SPECS[specId]
  if (!spec) {
    throw new Error(`Unknown spec ${specId}`)
  }
  const cases = INPUTS.map(([subjectType, fields]) => {
    const input = engine.subjectText(spec, subjectType, fields)
    return { subjectType, fields, input, contentHash: engine.contentHash(input) }
  })
  const vectors = await engine.embedTexts(spec, cases.map((c) => c.input))
  const golden = {
    embeddingSpecId: spec.embeddingSpecId,
    generatedAt: new Date().toISOString(),
    cases: cases.map((c, i) => ({ ...c, vector: engine.vectorToBase64(vectors[i]) })),
  }
  const dir = path.join(__dirname, 'golden')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${spec.embeddingSpecId}.json`)
  fs.writeFileSync(file, `${JSON.stringify(golden, null, 2)}\n`)
  console.log(`Wrote ${path.relative(process.cwd(), file)} with ${cases.length} cases`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
