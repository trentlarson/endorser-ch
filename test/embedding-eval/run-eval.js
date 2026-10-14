/**
 * Evaluate candidate embedding specs against the human-judged corpus.
 *
 * Usage (from the repo root):
 *   pkgx node test/embedding-eval/run-eval.js                 # all candidates
 *   pkgx node test/embedding-eval/run-eval.js <specId> ...    # a subset
 *
 * Models download on first use into EMBEDDING_MODEL_DIR
 * (default ~/.cache/endorser-embedding-models).
 *
 * Writes test/embedding-eval/results.md and results.json. See README.md for the metrics.
 */

const fs = require('fs')
const path = require('path')

const engine = require('../../src/api/services/embedding-engine')
const { CANDIDATES } = require('./candidates')

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf8'))
const subjectsById = new Map(corpus.subjects.map((s) => [s.id, s]))

const pairs = corpus.pairs.map(([a, b, grade, tag]) => {
  for (const id of [a, b]) {
    if (!subjectsById.has(id)) {
      throw new Error(`Pair references unknown subject ${id}`)
    }
  }
  return {
    a,
    b,
    grade,
    tag: tag || null,
    crossLingual: subjectsById.get(a).lang !== subjectsById.get(b).lang,
  }
})

function round(x, digits = 3) {
  return Number.isFinite(x) ? Number(x.toFixed(digits)) : null
}

function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN
}

function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
  const result = new Array(values.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) {
      j++
    }
    for (let k = i; k <= j; k++) {
      result[order[k][1]] = (i + j) / 2 + 1
    }
    i = j + 1
  }
  return result
}

function spearman(xs, ys) {
  const rx = ranks(xs)
  const ry = ranks(ys)
  const mx = mean(rx)
  const my = mean(ry)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

/**
 * Probability that a random "high" similarity exceeds a random "low" one.
 */
function auc(highs, lows) {
  let wins = 0
  for (const h of highs) {
    for (const l of lows) {
      wins += h > l ? 1 : h === l ? 0.5 : 0
    }
  }
  return wins / (highs.length * lows.length)
}

/**
 * Threshold that best separates grade-2 from grade-0 similarities (balanced accuracy).
 */
function bestThreshold(strongSims, weakSims) {
  const candidates = [...strongSims, ...weakSims].sort((x, y) => x - y)
  let best = { threshold: NaN, balancedAccuracy: -1 }
  for (let i = 0; i < candidates.length - 1; i++) {
    const t = (candidates[i] + candidates[i + 1]) / 2
    const tpr = strongSims.filter((s) => s >= t).length / strongSims.length
    const tnr = weakSims.filter((s) => s < t).length / weakSims.length
    const balancedAccuracy = (tpr + tnr) / 2
    if (balancedAccuracy > best.balancedAccuracy) {
      best = { threshold: t, balancedAccuracy }
    }
  }
  return best
}

/**
 * For each subject, every two judged partners with different grades should be
 * ordered by similarity. Returns accuracy overall and on subsets, plus the
 * worst inversions.
 */
function anchoredOrdering(scoredPairs) {
  const byAnchor = new Map()
  for (const p of scoredPairs) {
    for (const [anchor, other] of [[p.a, p.b], [p.b, p.a]]) {
      if (!byAnchor.has(anchor)) {
        byAnchor.set(anchor, [])
      }
      byAnchor.get(anchor).push({ ...p, other })
    }
  }
  const tallies = { all: [0, 0], crossLingual: [0, 0], hardNegative: [0, 0], truncation: [0, 0] }
  const inversions = []
  for (const [anchor, list] of byAnchor) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].grade === list[j].grade) {
          continue
        }
        const [hi, lo] = list[i].grade > list[j].grade ? [list[i], list[j]] : [list[j], list[i]]
        const score = hi.sim > lo.sim ? 1 : hi.sim === lo.sim ? 0.5 : 0
        const subsets = ['all']
        if (hi.crossLingual || lo.crossLingual) subsets.push('crossLingual')
        if (hi.tag === 'hard-negative' || lo.tag === 'hard-negative') subsets.push('hardNegative')
        if (hi.tag === 'truncation' || lo.tag === 'truncation') subsets.push('truncation')
        for (const s of subsets) {
          tallies[s][0] += score
          tallies[s][1] += 1
        }
        if (score < 1) {
          inversions.push({ anchor, expectedHigher: hi.other, expectedLower: lo.other, margin: lo.sim - hi.sim, hiSim: hi.sim, loSim: lo.sim })
        }
      }
    }
  }
  const accuracy = {}
  for (const [k, [correct, total]] of Object.entries(tallies)) {
    accuracy[k] = total ? correct / total : NaN
    accuracy[`${k}Count`] = total
  }
  inversions.sort((x, y) => y.margin - x.margin)
  return { accuracy, inversions }
}

async function evaluate(spec) {
  const inputs = corpus.subjects.map((s) => {
    const fields = s.type === 'query' ? { text: s.text } : { name: s.name, description: s.description }
    return engine.subjectText(spec, s.type, fields)
  })

  const loadStart = Date.now()
  await engine.embedTexts(spec, ['warm up'])
  const loadMs = Date.now() - loadStart

  const embedStart = Date.now()
  const vectors = await engine.embedTexts(spec, inputs)
  const msPerText = (Date.now() - embedStart) / inputs.length

  const vectorById = new Map(corpus.subjects.map((s, i) => [s.id, vectors[i]]))
  const scoredPairs = pairs.map((p) => ({ ...p, sim: engine.dot(vectorById.get(p.a), vectorById.get(p.b)) }))

  const byGrade = (g, filter = () => true) => scoredPairs.filter((p) => p.grade === g && filter(p)).map((p) => p.sim)
  const threshold = bestThreshold(byGrade(2), byGrade(0))
  const { accuracy, inversions } = anchoredOrdering(scoredPairs)

  return {
    spec,
    loadMs,
    msPerText,
    anchored: accuracy,
    auc2v0: auc(byGrade(2), byGrade(0)),
    auc2v0CrossLingual: auc(byGrade(2, (p) => p.crossLingual), byGrade(0, (p) => p.crossLingual)),
    spearman: spearman(scoredPairs.map((p) => p.sim), scoredPairs.map((p) => p.grade)),
    meanByGrade: [0, 1, 2].map((g) => mean(byGrade(g))),
    threshold,
    inversions,
    scoredPairs,
  }
}

function markdownReport(results, versions) {
  const lines = []
  lines.push('# Embedding Evaluation Results')
  lines.push('')
  lines.push(`Generated by \`test/embedding-eval/run-eval.js\` on ${new Date().toISOString().slice(0, 10)}; ${versions}.`)
  lines.push(`Corpus: ${corpus.subjects.length} subjects, ${pairs.length} judged pairs.`)
  lines.push('Sorted by anchored ordering accuracy. See README.md for metric definitions.')
  lines.push('')
  lines.push('| Spec | License | MB | Dims | Anchored | Cross-lingual | Hard-neg | Trunc. | AUC 2v0 | AUC 2v0 x-ling | Spearman | Threshold (bal. acc.) | Mean sim 0 / 1 / 2 | Load s | ms/text |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    const s = r.spec
    lines.push([
      '',
      `\`${s.embeddingSpecId}\`${s.note ? `<br>${s.note}` : ''}`,
      s.license,
      s.downloadMB,
      s.dimensions,
      round(r.anchored.all),
      round(r.anchored.crossLingual),
      round(r.anchored.hardNegative),
      round(r.anchored.truncation),
      round(r.auc2v0),
      round(r.auc2v0CrossLingual),
      round(r.spearman),
      `${round(r.threshold.threshold)} (${round(r.threshold.balancedAccuracy)})`,
      r.meanByGrade.map((m) => round(m, 2)).join(' / '),
      round(r.loadMs / 1000, 1),
      round(r.msPerText, 1),
      '',
    ].join(' | ').trim())
  }
  lines.push('')
  const counts = results[0].anchored
  lines.push(`Comparison counts: anchored ${counts.allCount}, cross-lingual ${counts.crossLingualCount}, hard-negative ${counts.hardNegativeCount}, truncation ${counts.truncationCount}.`)
  lines.push('')
  lines.push('## Worst inversions per spec')
  lines.push('')
  lines.push('Each row: for the anchor, the judged-better partner scored below the judged-worse one by the margin shown.')
  for (const r of results) {
    lines.push('')
    lines.push(`<details><summary><code>${r.spec.embeddingSpecId}</code> — ${r.inversions.length} inversions</summary>`)
    lines.push('')
    lines.push('| Anchor | Expected higher | Expected lower | Sims (higher / lower) |')
    lines.push('|---|---|---|---|')
    for (const inv of r.inversions.slice(0, 12)) {
      lines.push(`| ${inv.anchor} | ${inv.expectedHigher} | ${inv.expectedLower} | ${round(inv.hiSim)} / ${round(inv.loSim)} |`)
    }
    lines.push('')
    lines.push('</details>')
  }
  lines.push('')
  return lines.join('\n')
}

function writeResults(unsorted) {
  const results = [...unsorted].sort((x, y) => y.anchored.all - x.anchored.all)

  const pkg = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'node_modules', name, 'package.json'), 'utf8')).version
  const versions = `@huggingface/transformers ${pkg('@huggingface/transformers')}, onnxruntime-node ${pkg('onnxruntime-node')}, node ${process.version}`

  fs.writeFileSync(path.join(__dirname, 'results.md'), markdownReport(results, versions))
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results.map((r) => ({
    embeddingSpecId: r.spec.embeddingSpecId,
    anchored: r.anchored,
    auc2v0: r.auc2v0,
    auc2v0CrossLingual: r.auc2v0CrossLingual,
    spearman: r.spearman,
    meanByGrade: r.meanByGrade,
    threshold: r.threshold,
    pairSimilarities: r.scoredPairs.map((p) => [p.a, p.b, p.grade, round(p.sim, 4)]),
  })), null, 2))
}

async function main() {
  const requested = process.argv.slice(2)
  const specs = requested.length
    ? requested.map((id) => {
      const spec = CANDIDATES.find((c) => c.embeddingSpecId === id)
      if (!spec) {
        throw new Error(`Unknown candidate ${id}. Known: ${CANDIDATES.map((c) => c.embeddingSpecId).join(', ')}`)
      }
      return spec
    })
    : CANDIDATES

  const results = []
  for (const spec of specs) {
    process.stdout.write(`Evaluating ${spec.embeddingSpecId} ... `)
    let r
    try {
      r = await evaluate(spec)
    } catch (e) {
      console.log(`FAILED: ${e.message}`)
      continue
    }
    results.push(r)
    console.log(`anchored ${round(r.anchored.all)}, cross-lingual ${round(r.anchored.crossLingual)}, AUC ${round(r.auc2v0)}`)
    writeResults(results) // after each spec, so a crash keeps what finished
  }
  if (!results.length) {
    process.exitCode = 1
    return
  }
  console.log('Wrote test/embedding-eval/results.md and results.json')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
