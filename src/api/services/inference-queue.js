/**
 * The serial inference queue and the query-vector cache, kept free of DB and
 * model code so they can be tested alone.
 */

/**
 * Runs one job at a time. Jobs from run() (profile saves, the sweep) always
 * start before jobs from runQuery() (text queries), which wait in their own
 * queue with a cap.
 */
function createInferenceQueue() {
  const mainJobs = []
  const queryJobs = []
  let running = false

  function next() {
    if (running) {
      return
    }
    const job = mainJobs.shift() || queryJobs.shift()
    if (!job) {
      return
    }
    running = true
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .then(() => {
        running = false
        next()
      })
  }

  function add(jobs, fn) {
    return new Promise((resolve, reject) => {
      jobs.push({ fn, resolve, reject })
      next()
    })
  }

  return {
    /** @returns {Promise} the result of fn, once it has run */
    run: (fn) => add(mainJobs, fn),

    /**
     * @param {number} maxQueued - text queries allowed to wait; past that this rejects at once
     * @returns {Promise} the result of fn, once it has run; rejects with code QUERY_QUEUE_FULL when full
     */
    runQuery: (fn, maxQueued) => {
      // a query counts as queued until it starts, including when the worker is idle
      if (queryJobs.length >= maxQueued) {
        const err = new Error('Too many text queries are waiting for inference.')
        err.code = 'QUERY_QUEUE_FULL'
        return Promise.reject(err)
      }
      return add(queryJobs, fn)
    },

    /** @returns {{running: boolean, mainQueued: number, queryQueued: number}} */
    status: () => ({ running, mainQueued: mainJobs.length, queryQueued: queryJobs.length }),
  }
}

/**
 * A least-recently-used cache. A Map keeps insertion order, so the first key is
 * the oldest; get() moves a key to the end.
 */
function createLruCache() {
  const entries = new Map()
  return {
    get(key) {
      if (!entries.has(key)) {
        return undefined
      }
      const value = entries.get(key)
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    /** @param {number} maxSize - 0 or less stores nothing */
    set(key, value, maxSize) {
      entries.delete(key)
      if (!(maxSize > 0)) {
        entries.clear()
        return
      }
      entries.set(key, value)
      while (entries.size > maxSize) {
        entries.delete(entries.keys().next().value)
      }
    },
    clear: () => entries.clear(),
    size: () => entries.size,
  }
}

module.exports = {
  createInferenceQueue,
  createLruCache,
}
