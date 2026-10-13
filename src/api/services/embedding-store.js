/**
 * Storage of embedding vectors in an `embedding` table, for whichever DB holds
 * the subjects being embedded: profiles in the partner DB, plans in the main DB.
 * Both tables have the same schema, so this code serves both.
 *
 * See CHANGE/PLAN-interest-matching-architecture.md section 4.
 */

const util = require('./util')

// stays under SQLite's limit on bound parameters
const IN_CHUNK_SIZE = 500

class EmbeddingStore {

  /**
   * @param {object} db - a sqlite3 Database whose schema has the `embedding` table
   */
  constructor(db) {
    this.db = db
  }

  all(sql, params) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    })
  }

  run(sql, params) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  /**
   * Run a SELECT ... IN (...) over many IDs, in chunks.
   * @param {Array} ids
   * @param {function(string): string} sqlForPlaceholders - builds the SQL given the '?,?,...' list
   * @param {Array} leadingParams - parameters that precede the IDs
   * @returns {Promise<Array>} all rows
   */
  async allInChunks(ids, sqlForPlaceholders, leadingParams = []) {
    const rows = []
    for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + IN_CHUNK_SIZE)
      const sql = sqlForPlaceholders(chunk.map(() => '?').join(','))
      rows.push(...(await this.all(sql, [...leadingParams, ...chunk])))
    }
    return rows
  }

  /**
   * @param {Buffer} vector - float32 little-endian bytes
   * @returns {Promise<number>} number of rows changed
   */
  upsert(subjectType, subjectId, embeddingSpecId, contentHash, vector) {
    return this.run(
      `INSERT INTO embedding (subjectType, subjectId, embeddingSpecId, chunkIndex, contentHash, vector, updatedAt)
       VALUES (?, ?, ?, 0, ?, ?, datetime())
       ON CONFLICT(subjectType, subjectId, embeddingSpecId, chunkIndex) DO UPDATE SET
         contentHash = excluded.contentHash,
         vector = excluded.vector,
         updatedAt = datetime()`,
      [subjectType, String(subjectId), embeddingSpecId, contentHash, vector]
    )
  }

  /**
   * Delete a subject's vectors under every spec.
   * @returns {Promise<number>} number of rows deleted
   */
  deleteBySubject(subjectType, subjectId) {
    return this.run("DELETE FROM embedding WHERE subjectType = ? AND subjectId = ?", [subjectType, String(subjectId)])
  }

  /**
   * @returns {Promise<Map<string, string>>} subjectId -> contentHash
   */
  async hashes(subjectType, embeddingSpecId) {
    const rows = await this.all(
      "SELECT subjectId, contentHash FROM embedding WHERE subjectType = ? AND embeddingSpecId = ? AND chunkIndex = 0",
      [subjectType, embeddingSpecId]
    )
    return new Map(rows.map(row => [row.subjectId, row.contentHash]))
  }

  /**
   * Vectors for the given subjects, or for all subjects of the type when subjectIds is null.
   * @param {string[]|null} subjectIds
   * @returns {Promise<Array<{subjectId: string, chunkIndex: number, contentHash: string, vector: Buffer}>>}
   */
  bySubjects(subjectType, embeddingSpecId, subjectIds) {
    const columns = "subjectId, chunkIndex, contentHash, vector"
    if (subjectIds == null) {
      return this.all(
        `SELECT ${columns} FROM embedding WHERE subjectType = ? AND embeddingSpecId = ?`,
        [subjectType, embeddingSpecId]
      )
    }
    return this.allInChunks(
      subjectIds.map(String),
      (placeholders) => `SELECT ${columns} FROM embedding
                         WHERE subjectType = ? AND embeddingSpecId = ? AND subjectId IN (${placeholders})`,
      [subjectType, embeddingSpecId]
    )
  }

  /**
   * Vectors stored inside a time window.
   * @param {string} afterDateIso - only vectors with updatedAt after this
   * @param {string} [beforeDateIso] - only vectors with updatedAt before this
   * @returns {Promise<Array<{subjectId: string, chunkIndex: number, vector: Buffer, updatedAt: string}>>}
   */
  async updatedBetween(subjectType, embeddingSpecId, afterDateIso, beforeDateIso) {
    let sql = `SELECT subjectId, chunkIndex, vector, updatedAt FROM embedding
               WHERE embeddingSpecId = ? AND subjectType = ? AND updatedAt > datetime(?)`
    const params = [embeddingSpecId, subjectType, afterDateIso]
    if (beforeDateIso) {
      sql += " AND updatedAt < datetime(?)"
      params.push(beforeDateIso)
    }
    const rows = await this.all(sql, params)
    rows.forEach(row => {
      row.updatedAt = util.isoAndZonify(row.updatedAt)
    })
    return rows
  }

  /**
   * One page of vectors ordered by subjectId (text order).
   * @param {string[]|null} subjectIds - restrict to these, or null for all
   * @param {string} afterId - return only subjectIds after this one
   * @returns {Promise<{data: Array<{subjectId, chunkIndex, contentHash, vector}>, hitLimit: boolean}>}
   */
  async paged(subjectType, embeddingSpecId, subjectIds, afterId, limit) {
    let rows
    if (subjectIds == null) {
      rows = await this.all(
        `SELECT subjectId, chunkIndex, contentHash, vector FROM embedding
         WHERE subjectType = ? AND embeddingSpecId = ? AND subjectId > ?
         ORDER BY subjectId, chunkIndex LIMIT ${limit}`,
        [subjectType, embeddingSpecId, afterId || '']
      )
    } else {
      // compare as text, like the SQL above, so paging works the same either way
      const pageIds = subjectIds.map(String).filter(id => id > (afterId || '')).sort().slice(0, limit)
      rows = await this.bySubjects(subjectType, embeddingSpecId, pageIds)
      rows.sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : a.chunkIndex - b.chunkIndex))
    }
    return { data: rows, hitLimit: rows.length === limit }
  }

  /**
   * @returns {Promise<Array<{subjectType: string, count: number}>>}
   */
  counts(embeddingSpecId) {
    return this.all(
      "SELECT subjectType, COUNT(*) AS count FROM embedding WHERE embeddingSpecId = ? GROUP BY subjectType",
      [embeddingSpecId]
    )
  }
}

module.exports = { EmbeddingStore }
