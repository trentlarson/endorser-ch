/**
 * Review the corpus judgments blind: shows each pair in corpus.json without
 * its grade, asks for your own (0, 1, or 2), and then lists the pairs where
 * your grade differs from the corpus.
 *
 * Usage (from the repo root, in a terminal):
 *   npm run embedding:review              # continues where you stopped
 *   npm run embedding:review -- --restart # forgets earlier answers
 *
 * Press 0, 1, or 2 (no Enter needed), or x to stop; answers are saved after each pair in review-answers.json
 * (not committed), so the next run picks up at the first unanswered pair.
 * Grades: 2 = strong (show it when viewing the other), 1 = moderate (related,
 * lower in a list), 0 = weak or unrelated.
 */

const fs = require('fs')
const path = require('path')

const corpus = require('./corpus.json')

const ANSWERS_FILE = path.join(__dirname, 'review-answers.json')
const subjects = new Map(corpus.subjects.map((s) => [s.id, s]))

function pairKey([a, b]) {
  return `${a} | ${b}`
}

function subjectText(s) {
  if (s.type === 'plan') {
    return [s.name, s.description].filter(Boolean).join(' — ')
  }
  return s.type === 'query' ? s.text : s.description
}

// long texts show their start and end, since the end can matter (see the 'truncation' tag)
function shorten(text, edge = 300) {
  if (text.length <= edge * 2 + 100) {
    return text
  }
  return `${text.slice(0, edge)} … [${text.length - edge * 2} characters omitted] … ${text.slice(-edge)}`
}

// eg. "  profile: I grow tomatoes..."; withId adds a line with the corpus ID
function describe(id, withId = false) {
  const s = subjects.get(id)
  const line = `  ${(s.type + ':').padEnd(9)}${shorten(subjectText(s))}`
  return withId ? `${line}\n           (${id})` : line
}

/****************************************************************
 * Single-key input: raw mode in a terminal; piped input is read character by character.
 **/

const pendingKeys = []
let keyWaiter = null
let inputEnded = false

function deliverKey() {
  if (keyWaiter && (pendingKeys.length > 0 || inputEnded)) {
    const resolve = keyWaiter
    keyWaiter = null
    resolve(pendingKeys.length > 0 ? pendingKeys.shift() : null)
  }
}

function startKeyInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    pendingKeys.push(...chunk)
    deliverKey()
  })
  process.stdin.on('end', () => {
    inputEnded = true
    deliverKey()
  })
}

function stopKeyInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false)
  }
  process.stdin.pause()
}

/**
 * @returns {Promise<string>} '0', '1', '2', or 'x' (also for Ctrl-C or the end of piped input)
 */
async function askGrade() {
  process.stdout.write('  grade (0/1/2, x to stop): ')
  for (;;) {
    const key = await new Promise((resolve) => {
      keyWaiter = resolve
      deliverKey()
    })
    const grade = key == null || key === '\u0003' ? 'x' : key.toLowerCase()
    if (['0', '1', '2', 'x'].includes(grade)) {
      process.stdout.write(`${grade}\n`)
      return grade
    }
    // ignore any other key
  }
}

function loadAnswers(restart) {
  if (restart || !fs.existsSync(ANSWERS_FILE)) {
    return {}
  }
  return JSON.parse(fs.readFileSync(ANSWERS_FILE, 'utf8'))
}

function report(answers) {
  const answered = corpus.pairs.filter((p) => answers[pairKey(p)] != null)
  if (answered.length === 0) {
    console.log('\nNo answers yet.')
    return
  }
  const mismatches = answered.filter((p) => answers[pairKey(p)] !== p[2])
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Answered ${answered.length} of ${corpus.pairs.length} pairs; ${answered.length - mismatches.length} match the corpus, ${mismatches.length} differ.`)

  // rows: corpus grade, columns: your grade
  const counts = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  answered.forEach((p) => counts[p[2]][answers[pairKey(p)]]++)
  console.log('\n             you: 0    1    2')
  counts.forEach((row, grade) => console.log(`  corpus ${grade}:     ${row.map((n) => String(n).padEnd(5)).join('')}`))

  mismatches.forEach((p, i) => {
    const [a, b, grade, tag] = p
    console.log(`\n${i + 1}. corpus ${grade}, you ${answers[pairKey(p)]}${tag ? `  [${tag}]` : ''}`)
    console.log(describe(a, true))
    console.log(describe(b, true))
  })
  if (mismatches.length > 0) {
    console.log('\nTo adopt your grades, edit the third element of those pairs in corpus.json, then rerun: npm run embedding:eval')
  }
}

async function main() {
  const answers = loadAnswers(process.argv.includes('--restart'))
  const remaining = corpus.pairs.filter((p) => answers[pairKey(p)] == null)
  startKeyInput()
  console.log(`${remaining.length} of ${corpus.pairs.length} pairs to review. Press 0, 1, or 2 (x to stop).`)
  console.log('2 = strong (show it when viewing the other), 1 = moderate (related, lower in a list), 0 = weak or unrelated')

  for (let i = 0; i < remaining.length; i++) {
    const pair = remaining[i]
    console.log(`\n--- ${corpus.pairs.length - remaining.length + i + 1} / ${corpus.pairs.length} ---`)
    console.log(describe(pair[0]))
    console.log(describe(pair[1]))
    const input = await askGrade()
    if (input === 'x') {
      break
    }
    answers[pairKey(pair)] = Number(input)
    fs.writeFileSync(ANSWERS_FILE, `${JSON.stringify(answers, null, 2)}\n`)
  }
  stopKeyInput()
  report(answers)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
