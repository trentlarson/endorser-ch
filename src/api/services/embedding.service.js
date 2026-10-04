/**
 * Embedding generation and storage for profiles and plans.
 *
 * Profiles are embedded when saved. A periodic sweep compares each subject's
 * current text hash with its stored vector's hash and fixes mismatches; it is
 * the backfill, the retry for failed saves, and the only path for plans (so
 * claim submission does no embedding work).
 *
 * See CHANGE/PLAN-interest-matching-architecture.md section 5.
 */

const engine = require('./embedding-engine')
const { activeEmbeddingSpec } = require('./embedding-specs')
const { dbService: partnerDbService } = require('./partner.db.service')
const { dbService: endorserDbService } = require('./endorser.db.service')
const l = require('../../common/logger')

const SUBJECT_PROFILE = 'profile'
const SUBJECT_PLAN = 'plan'

// One inference at a time keeps CPU use bounded and the API responsive.
let inferenceQueue = Promise.resolve()
function enqueue(fn) {
  const result = inferenceQueue.then(fn)
  inferenceQueue = result.catch(() => {})
  return result
}

/**
 * @param {object} spec
 * @param {string} text - preprocessed, non-empty
 * @returns {Promise<Float32Array>}
 */
function embedOne(spec, text) {
  return enqueue(() => engine.embedTexts(spec, [text])).then((vectors) => vectors[0])
}

function profileText(spec, description) {
  return engine.subjectText(spec, SUBJECT_PROFILE, { description })
}

function planText(spec, plan) {
  return engine.subjectText(spec, SUBJECT_PLAN, { name: plan.name, description: plan.description })
}

/**
 * Embed a profile's current description and store it. Never throws: on failure
 * the profile's vectors are deleted, so matching never uses a vector for text
 * the user has replaced, and the sweep retries.
 *
 * @param {number} rowId - user_profile.rowid
 * @param {string} description
 * @returns {Promise<boolean>} whether the profile now has a current vector
 */
async function refreshProfileEmbedding(rowId, description) {
  const spec = activeEmbeddingSpec()
  const text = profileText(spec, description)
  try {
    if (text === '') {
      await partnerDbService.embeddingDeleteBySubject(SUBJECT_PROFILE, rowId)
      return false
    }
    const vector = await embedOne(spec, text)
    await partnerDbService.embeddingUpsert(
      SUBJECT_PROFILE, rowId, spec.embeddingSpecId, engine.contentHash(text), engine.vectorToBlob(vector)
    )
    return true
  } catch (err) {
    l.error('Error embedding profile ' + rowId + ' (the sweep will retry): ' + err)
    await partnerDbService.embeddingDeleteBySubject(SUBJECT_PROFILE, rowId)
      .catch((delErr) => l.error('Also failed to delete stale embedding for profile ' + rowId + ': ' + delErr))
    return false
  }
}

/**
 * Embed free text (eg. a search query) without storing it.
 * @returns {Promise<Float32Array|null>} null when the text is empty
 */
async function embedQuery(text) {
  const spec = activeEmbeddingSpec()
  const input = engine.subjectText(spec, 'query', { text })
  return input === '' ? null : embedOne(spec, input)
}

/**
 * Vectors for subjects, grouped by subject.
 * @param {string} subjectType
 * @param {Array<string|number>|null} subjectIds - null for all subjects of the type
 * @returns {Promise<Map<string, Float32Array[]>>} subjectId -> vectors ordered by chunkIndex
 */
async function vectorsBySubject(subjectType, subjectIds) {
  const spec = activeEmbeddingSpec()
  const rows = await partnerDbService.embeddingsBySubjects(subjectType, spec.embeddingSpecId, subjectIds)
  rows.sort((a, b) => a.chunkIndex - b.chunkIndex)
  const result = new Map()
  for (const row of rows) {
    if (!result.has(row.subjectId)) {
      result.set(row.subjectId, [])
    }
    result.get(row.subjectId).push(engine.blobToVector(row.vector))
  }
  return result
}

/****************************************************************
 * Sweep
 **/

const sweepStatus = {
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastResult: null, // { embeddingSpecId, profile: counts, plan: counts }
  lastError: null,
}
let runningSweep = null

/**
 * Bring one subject type's vectors in line with its current texts.
 *
 * @param {object} spec
 * @param {string} subjectType
 * @param {Array<{id: string, text: string}>} subjects - current preprocessed texts
 * @param {function(string): Promise<string|null>} currentText - re-reads one subject's text just before
 *   storing its vector, so a save made during the embedding isn't overwritten with an older vector
 * @returns {Promise<{current: number, embedded: number, deleted: number}>}
 */
async function sweepSubjects(spec, subjectType, subjects, currentText) {
  const counts = { current: 0, embedded: 0, deleted: 0 }
  const storedHashes = await partnerDbService.embeddingHashes(subjectType, spec.embeddingSpecId)
  const liveIds = new Set()
  for (const { id, text } of subjects) {
    if (text === '') {
      continue
    }
    liveIds.add(id)
    const hash = engine.contentHash(text)
    if (storedHashes.get(id) === hash) {
      counts.current++
      continue
    }
    const vector = await embedOne(spec, text)
    if ((await currentText(id)) === text) {
      await partnerDbService.embeddingUpsert(subjectType, id, spec.embeddingSpecId, hash, engine.vectorToBlob(vector))
      counts.embedded++
    }
  }
  for (const id of storedHashes.keys()) {
    if (!liveIds.has(id)) {
      await partnerDbService.embeddingDeleteBySubject(subjectType, id)
      counts.deleted++
    }
  }
  return counts
}

async function sweepOnce() {
  const spec = activeEmbeddingSpec()

  const profiles = await partnerDbService.profilesAllDescriptions()
  const profileCounts = await sweepSubjects(
    spec,
    SUBJECT_PROFILE,
    profiles.map((p) => ({ id: String(p.rowid), text: profileText(spec, p.description) })),
    async (id) => {
      const profile = await partnerDbService.profileById(Number(id))
      return profile ? profileText(spec, profile.description) : null
    }
  )

  const plans = await endorserDbService.plansAllNamesDescriptions()
  const planCounts = await sweepSubjects(
    spec,
    SUBJECT_PLAN,
    plans.map((p) => ({ id: p.handleId, text: planText(spec, p) })),
    async (id) => {
      const plan = await endorserDbService.planInfoByHandleId(id)
      return plan ? planText(spec, plan) : null
    }
  )

  return { embeddingSpecId: spec.embeddingSpecId, profile: profileCounts, plan: planCounts }
}

/**
 * Run a sweep, or join the one already running. Never throws; failures are
 * logged and recorded in the status.
 * @returns {Promise<object>} the sweep status after it finishes
 */
function sweep() {
  if (!runningSweep) {
    sweepStatus.running = true
    sweepStatus.lastStartedAt = new Date().toISOString()
    runningSweep = sweepOnce()
      .then((result) => {
        sweepStatus.lastResult = result
        sweepStatus.lastError = null
        const changed = result.profile.embedded + result.profile.deleted + result.plan.embedded + result.plan.deleted
        const summary = 'Embedding sweep for ' + result.embeddingSpecId + ': ' + JSON.stringify({ profile: result.profile, plan: result.plan })
        if (changed > 0) {
          l.warn(summary)
        } else {
          l.info(summary)
        }
      })
      .catch((err) => {
        sweepStatus.lastError = String(err)
        l.error('Embedding sweep failed (it will retry next interval): ' + err)
      })
      .then(() => {
        sweepStatus.running = false
        sweepStatus.lastFinishedAt = new Date().toISOString()
        runningSweep = null
        return getSweepStatus()
      })
  }
  return runningSweep
}

function getSweepStatus() {
  return { ...sweepStatus }
}

/**
 * Sweep once now and then every EMBEDDING_SWEEP_INTERVAL_MINUTES (default 60);
 * a value of 0 disables both.
 */
function startSweepSchedule() {
  const minutes = Number(process.env.EMBEDDING_SWEEP_INTERVAL_MINUTES ?? 60)
  if (!(minutes > 0)) {
    return
  }
  sweep()
  setInterval(sweep, minutes * 60 * 1000).unref()
}

module.exports = {
  SUBJECT_PROFILE,
  SUBJECT_PLAN,
  refreshProfileEmbedding,
  embedQuery,
  vectorsBySubject,
  sweep,
  getSweepStatus,
  startSweepSchedule,
}
