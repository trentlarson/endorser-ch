const sqlite3 = require('sqlite3').verbose()

const partnerDbInfo = require('../../conf/flyway-partner.js')
const partnerDb = new sqlite3.Database(partnerDbInfo.fileLoc)
const util = require('./util')

const DEFAULT_LIMIT = 50

// stays under SQLite's limit on bound parameters
const IN_CHUNK_SIZE = 500

/**
 * Run a SELECT ... IN (...) over many IDs, in chunks.
 * @param {Array} ids
 * @param {function(string): string} sqlForPlaceholders - builds the SQL given the '?,?,...' list
 * @param {Array} leadingParams - parameters that precede the IDs
 * @returns {Promise<Array>} all rows
 */
async function allInChunks(ids, sqlForPlaceholders, leadingParams = []) {
  const rows = []
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE)
    const sql = sqlForPlaceholders(chunk.map(() => '?').join(','))
    const chunkRows = await new Promise((resolve, reject) => {
      partnerDb.all(sql, [...leadingParams, ...chunk], (err, result) => (err ? reject(err) : resolve(result)))
    })
    rows.push(...chunkRows)
  }
  return rows
}

class PartnerDatabase {

  /****************************************************************
   * Partner System
   **/

  partnerLinkInsert(entry) {
    return new Promise((resolve, reject) => {
      const stmt =
        "INSERT INTO partner_link"
        + " (handleId, linkCode, externalId, createdAt, data, pubKeyHex, pubKeyImage, pubKeySigHex)"
        + " VALUES (?, ?, ?, dateTime(), ?, ?, ?, ?)"
      partnerDb.run(
        stmt,
        [
          entry.handleId, entry.linkCode, entry.externalId, entry.data,
          entry.pubKeyHex, entry.pubKeyImage, entry.pubKeySigHex],
        function(err) {
          if (err) {
            reject(err)
          } else {
            resolve(this.lastID)
          }
        }
      )
    })
  }

  partnerLinkForCode(handleId, linkCode) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        "SELECT * FROM partner_link WHERE handleId = ? and linkCode = ?",
        [handleId, linkCode],
        function (err, row) {
          if (err) {
            reject(err)
          } else {
            if (row) {
              row.createdAt = util.isoAndZonify(row.createdAt)
            }
            resolve(row)
          }
        })
    })
  }






  /****************************************************************
   * Group Onboarding
   **/

  groupOnboardInsert(issuerDid, name, expiresAt, projectLink) {
    return new Promise((resolve, reject) => {
      const stmt = "INSERT INTO group_onboard (issuerDid, name, expiresAt, projectLink) VALUES (?, ?, datetime(?), ?)"
      partnerDb.run(stmt, [issuerDid, name, expiresAt, projectLink], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  groupOnboardGetByIssuerDid(issuerDid) {
    return new Promise((resolve, reject) => {
      partnerDb.get("SELECT rowid as groupId, * FROM group_onboard WHERE issuerDid = ?", [issuerDid], function(err, row) {
        if (err) {
          reject(err)
        } else {
          if (row) {
            row.createdAt = util.isoAndZonify(row.createdAt)
            row.expiresAt = util.isoAndZonify(row.expiresAt)
          }
          resolve(row)
        }
      })
    })
  }

  groupOnboardGetByRowId(rowId) {
    return new Promise((resolve, reject) => {
      partnerDb.get("SELECT rowid as groupId, * FROM group_onboard WHERE rowid = ?", [rowId], function(err, row) {
        if (err) {
          reject(err)
        } else {
          if (row) {
            row.createdAt = row.createdAt ? util.isoAndZonify(row.createdAt) : null
            row.expiresAt = row.expiresAt ? util.isoAndZonify(row.expiresAt) : null
          }
          resolve(row)
        }
      })
    })
  }

  groupOnboardGetAllActive() {
    return new Promise((resolve, reject) => {
      partnerDb.all("SELECT rowid as groupId, name, expiresAt FROM group_onboard WHERE expiresAt > datetime('now')", function(err, rows) {
        if (err) {
          reject(err)
        } else {
          rows.forEach(row => {
            row.expiresAt = util.isoAndZonify(row.expiresAt)
          })
          resolve(rows)
        }
      })
    })
  }

  groupOnboardDeleteByRowAndIssuer(rowId, issuerDid) {
    return new Promise((resolve, reject) => {
      const stmt = "DELETE FROM group_onboard WHERE rowid = ? AND issuerDid = ?"
      partnerDb.run(stmt, [rowId, issuerDid], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardUpdate(id, issuerDid, name, expiresAt, projectLink) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard SET name = ?, expiresAt = datetime(?), projectLink = ? WHERE issuerDid = ? AND rowid = ?"
      partnerDb.run(stmt, [name, expiresAt, projectLink, issuerDid, id], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardUpdatePreviousMatches(groupId, previousMatchesJson) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard SET previousMatches = ? WHERE rowid = ?"
      partnerDb.run(stmt, [previousMatchesJson, groupId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  /****************************************************************
   * Group Onboarding Members
   **/

  groupOnboardMemberInsert(issuerDid, groupId, content, admitted = false) {
    return new Promise((resolve, reject) => {
      const stmt = "INSERT INTO group_onboard_member (issuerDid, groupId, content, admitted) VALUES (?, ?, ?, ?)"
      partnerDb.run(stmt, [issuerDid, groupId, content, admitted ? 1 : 0], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  groupOnboardMemberDelete(issuerDid) {
    return new Promise((resolve, reject) => {
      const stmt = "DELETE FROM group_onboard_member WHERE issuerDid = ?"
      partnerDb.run(stmt, [issuerDid], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberDeleteByGroupId(groupId) {
    return new Promise((resolve, reject) => {
      const stmt = "DELETE FROM group_onboard_member WHERE groupId = ?"
      partnerDb.run(stmt, [groupId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberUpdateContent(memberId, content) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard_member SET content = ? WHERE rowid = ?"
      partnerDb.run(stmt, [content, memberId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberUpdateAdmitted(memberId, admitted) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard_member SET admitted = ? WHERE rowid = ?"
      partnerDb.run(stmt, [admitted ? 1 : 0, memberId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberGetByRowId(memberId) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        "SELECT rowid as memberId, * FROM group_onboard_member WHERE rowid = ?",
        [memberId],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row) {
              row.admitted = util.booleanify(row.admitted)
            }
            resolve(row)
          }
        }
      )
    })
  }

  groupOnboardMemberGetByIssuerDid(issuerDid) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        "SELECT rowid as memberId, * FROM group_onboard_member WHERE issuerDid = ?",
        [issuerDid],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row) {
              row.admitted = util.booleanify(row.admitted)
            }
            resolve(row)
          }
        }
      )
    })
  }

  /**
   * Get all members of a group, ordered by rowid AKA memberId
   *
   * @param {string} groupId
   * @returns {Promise<Array<{memberId: string, content: string, admitted: boolean}>>}
   */
  groupOnboardMembersGetByGroup(groupId) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        // the first in the list is the organizer
        "SELECT m.rowid as memberId, m.*, m.groupId, g.issuerDid as organizerDid FROM group_onboard_member m JOIN group_onboard g ON m.groupId = g.rowid WHERE m.groupId = ? ORDER BY m.rowid",
        [groupId],
        function(err, rows) {
          if (err) {
            reject(err)
          } else {
            rows.forEach(row => {
              row.admitted = util.booleanify(row.admitted)
            })
            resolve(rows)
          }
        }
      )
    })
  }








  /****************************************************************
   * User Profile
   **/

  profileInsertOrUpdate(entry) {
    return new Promise((resolve, reject) => {
      // SQLite-specific
      const stmt = `
        INSERT INTO user_profile
          (issuerDid, updatedAt, description, locLat, locLon, locLat2, locLon2)
        VALUES (?, datetime(), ?, ?, ?, ?, ?)
        ON CONFLICT(issuerDid) DO UPDATE SET
          updatedAt = datetime(),
          description = excluded.description,
          locLat = excluded.locLat,
          locLon = excluded.locLon,
          locLat2 = excluded.locLat2,
          locLon2 = excluded.locLon2
        WHERE issuerDid = ?`
      partnerDb.run(
        stmt,
        [entry.issuerDid, entry.description, entry.locLat, entry.locLon, entry.locLat2, entry.locLon2, entry.issuerDid],
        function(err) {
          if (!err && this.changes === 1) {
            resolve(this.lastID)
          } else if (!err && this.changes === 0) {
            // If no row was updated, we should insert instead
            resolve(false)
          } else {
            reject(err)
          }
        }
      )
    })
  }

  profileById(rowid) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        `SELECT rowid, issuerDid, updatedAt, description, locLat, locLon, locLat2, locLon2
         FROM user_profile
         WHERE rowid = ?`,
        [rowid],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row) {
              row.updatedAt = util.isoAndZonify(row.updatedAt)
            }
            resolve(row)
          }
        }
      )
    })
  }

  profileByIssuerDid(issuerDid) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        `SELECT rowid, issuerDid, updatedAt, description, locLat, locLon, locLat2, locLon2
         FROM user_profile
         WHERE issuerDid = ?`,
        [issuerDid],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row) {
              row.rowId = row.rowid
              row.updatedAt = util.isoAndZonify(row.updatedAt)
            }
            resolve(row)
          }
        }
      )
    })
  }

  /**
   * Profiles in bounding box updated after the given ISO date.
   * user_profile has no JWT; caller decodes afterId to ISO and passes here.
   * @param {string} beforeDateIso - optional; only return profiles with updatedAt < beforeDateIso
   * Returns Promise of { data: [], hitLimit: boolean }
   */
  profilesByLocationAfterDate(minLat, minLon, maxLat, maxLon, afterDateIso, beforeDateIso) {
    return new Promise((resolve, reject) => {
      if (minLat == null || minLon == null || maxLat == null || maxLon == null) {
        resolve({ data: [], hitLimit: false })
        return
      }
      let whereClause = "((locLat >= ? AND locLat <= ? AND locLon >= ? AND locLon <= ?) OR (locLat2 >= ? AND locLat2 <= ? AND locLon2 >= ? AND locLon2 <= ?)) AND updatedAt > datetime(?)"
      const params = [minLat, maxLat, minLon, maxLon, minLat, maxLat, minLon, maxLon, afterDateIso]
      if (beforeDateIso) {
        whereClause += " AND updatedAt < datetime(?)"
        params.push(beforeDateIso)
      }
      const sql = `SELECT rowid as rowid, * FROM user_profile WHERE ${whereClause} ORDER BY updatedAt DESC LIMIT ${DEFAULT_LIMIT}`

      partnerDb.all(sql, params, function (err, rows) {
        if (err) {
          reject(err)
        } else {
          const hitLimit = rows.length === DEFAULT_LIMIT
          rows = rows.map(row => {
            row.rowId = row.rowid
            row.updatedAt = util.isoAndZonify(row.updatedAt)
            return row
          })
          resolve({ data: rows, hitLimit })
        }
      })
    })
  }

  profilesByLocationAndContentsPaged(minLat, minLon, maxLat, maxLon, beforeRowId, afterRowId, claimContents) {
    return new Promise((resolve, reject) => {
      let whereClause = ""
      const params = []

      // Only add location conditions if all coordinates are defined
      if (minLat != null && minLon != null && maxLat != null && maxLon != null) {
        whereClause = "((locLat >= ? AND locLat <= ? AND locLon >= ? AND locLon <= ?) OR (locLat2 >= ? AND locLat2 <= ? AND locLon2 >= ? AND locLon2 <= ?))"
        params.push(minLat, maxLat, minLon, maxLon, minLat, maxLat, minLon, maxLon)
      }

      // Add text search if claimContents is provided
      if (claimContents) {
        // Split into words for multi-word search
        const terms = claimContents.split(" ")
        for (const term of terms) {
          const trimmed = term.trim()
          if (trimmed.length > 0) {
            whereClause = (whereClause ? `${whereClause} AND ` : "") + "INSTR(lower(description), lower(?))"
            params.push(trimmed)
          }
        }
      } else if (whereClause === "") {
        // there's no claim string search, and no location search,
        // so don't pick up any that don't have a description
        whereClause = "description != ''"
      }

      if (beforeRowId) {
        whereClause = (whereClause ? `${whereClause} AND ` : "") + "rowid < ?"
        params.push(beforeRowId)
      }
      if (afterRowId) {
        whereClause = (whereClause ? `${whereClause} AND ` : "") + "rowid > ?"
        params.push(afterRowId)
      }

      // If no conditions were added, return all profiles
      const finalWhereClause = whereClause ? `WHERE ${whereClause}` : ""
      // without the "rowid as rowid" we just get an "id" column (weird)
      const sql = `SELECT rowid as rowid, * FROM user_profile ${finalWhereClause} ORDER BY rowid DESC LIMIT ${DEFAULT_LIMIT}`

      partnerDb.all(sql, params, function(err, rows) {
        if (err) {
          reject(err)
        } else {
          const hitLimit = rows.length === DEFAULT_LIMIT
          rows = rows.map(row => {
            row.rowId = row.rowid
            row.updatedAt = util.isoAndZonify(row.updatedAt)
            return row
          })
          resolve({
            data: rows,
            hitLimit
          })
        }
      })
    })
  }

  // similar to Endorser DB planCountsByBBox
  profileCountsByBBox(minLat, westLon, maxLat, eastLon, numTiles, useLoc2 = false) {
    if (minLat === maxLat) {
      return Promise.resolve({ data: [], error: "Note that the minimum and maximum latitude must be different." })
    }
    if (westLon === eastLon) {
      return Promise.resolve({ data: [], error: "Note that the minimum and maximum longitude must be different." })
    }
    if (minLat === -90 && maxLat === 90) {
      // they're zoomed out maximum latitudes, so we'll change the box to include all longitudes
      westLon = -180
      eastLon = 180
    } else if (westLon > eastLon) {
      // their viewport crosses the prime meridian
      // let's take whichever takes up the most room of the screen
      const westLonDiff = 180 - westLon // distance to the right edge of the screen
      const eastLonDiff = eastLon - -180 // distance to the left edge of the screen
      if (westLonDiff > eastLonDiff) {
        // there's more on the western side, so we'll change the easternmost to be 0
        eastLon = 180
        if (westLon == 180) {
          // this should never happen, but let's be safe
          westLon = -180
        }
      } else {
        // there's more on the eastern side, so we'll change the westernmost to be -180
        westLon = -180
        if (eastLon == -180) {
          // this should never happen, but let's be safe
          eastLon = 180
        }
      }
    }
    // we'll add a little bit to the denominator
    // to avoid a boundary right on the border
    // and to deal with rounding errors (eg. when we've got .99999...)
    // either of which would push an index to 4, out of bounds
    const boxLatWidth = maxLat - minLat + 0.000001
    const boxLonHeight = eastLon - westLon + 0.000001

    const suffix = useLoc2 ? "2" : ""
    const sql = `
      SELECT
        indexLat,
        indexLon,
        MIN(locLat${suffix}) AS minFoundLat,
        MAX(locLat${suffix}) AS maxFoundLat,
        MIN(locLon${suffix}) AS minFoundLon,
        MAX(locLon${suffix}) AS maxFoundLon,
        COUNT(indexLat) AS recordCount
      FROM (
        SELECT
          FLOOR(? * (locLat${suffix} - ?) / ?) AS indexLat,
          FLOOR(? * (locLon${suffix} - ?) / ?) AS indexLon,
          locLat${suffix},
          locLon${suffix}
        FROM user_profile
        WHERE
          locLat${suffix} BETWEEN ? AND ?
          AND locLon${suffix} BETWEEN ? AND ?
      )
      GROUP BY indexLat, indexLon
    `
    const params = [numTiles, minLat, boxLatWidth, numTiles, westLon, boxLonHeight, minLat, maxLat, westLon, eastLon]
    const data = []
    return new Promise(
      (resolve, reject) => {
        partnerDb.each(
          sql,
          params,
          function(err, row) {
            if (err) {
              reject(err)
            }
            data.push(row)
          },
          (err, num) => {
            if (err) {
              reject(err)
            } else {
              resolve(data)
            }
          }
        )
      }
    )
  }

  /**
   * Delete a profile and its embeddings.
   * @returns {Promise<number>} number of profiles deleted
   */
  async profileDelete(issuerDid) {
    const profile = await this.profileByIssuerDid(issuerDid)
    if (profile) {
      await this.embeddingDeleteBySubject('profile', String(profile.rowid))
    }
    return new Promise((resolve, reject) => {
      partnerDb.run("DELETE FROM user_profile WHERE issuerDid = ?", [issuerDid], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  /**
   * Text of every profile, for computing embeddings.
   * @returns {Promise<Array<{rowid: number, description: string}>>}
   */
  profilesAllDescriptions() {
    return new Promise((resolve, reject) => {
      partnerDb.all("SELECT rowid, description FROM user_profile", [], function(err, rows) {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  /**
   * All profile IDs with either location inside the bounding box.
   * @returns {Promise<number[]>}
   */
  profileRowIdsByLocation(minLat, minLon, maxLat, maxLon) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        `SELECT rowid FROM user_profile
         WHERE (locLat >= ? AND locLat <= ? AND locLon >= ? AND locLon <= ?)
            OR (locLat2 >= ? AND locLat2 <= ? AND locLon2 >= ? AND locLon2 <= ?)`,
        [minLat, maxLat, minLon, maxLon, minLat, maxLat, minLon, maxLon],
        function(err, rows) {
          if (err) {
            reject(err)
          } else {
            resolve(rows.map(row => row.rowid))
          }
        }
      )
    })
  }

  /**
   * @param {number[]} rowIds
   * @returns {Promise<Array>} profiles, in no particular order
   */
  async profilesByRowIds(rowIds) {
    const rows = await allInChunks(
      rowIds,
      (placeholders) => `SELECT rowid, issuerDid, updatedAt, description, locLat, locLon, locLat2, locLon2
                         FROM user_profile WHERE rowid IN (${placeholders})`
    )
    return rows.map(row => {
      row.rowId = row.rowid
      row.updatedAt = util.isoAndZonify(row.updatedAt)
      return row
    })
  }

  /****************************************************************
   * Embeddings (for semantic matching)
   *
   * subjectType is 'profile' (subjectId = user_profile.rowid as text)
   * or 'plan' (subjectId = plan_claim.handleId in the main DB).
   **/

  /**
   * @param {Buffer} vector - float32 little-endian bytes
   */
  embeddingUpsert(subjectType, subjectId, embeddingSpecId, contentHash, vector) {
    return new Promise((resolve, reject) => {
      const stmt = `
        INSERT INTO embedding (subjectType, subjectId, embeddingSpecId, chunkIndex, contentHash, vector, updatedAt)
        VALUES (?, ?, ?, 0, ?, ?, datetime())
        ON CONFLICT(subjectType, subjectId, embeddingSpecId, chunkIndex) DO UPDATE SET
          contentHash = excluded.contentHash,
          vector = excluded.vector,
          updatedAt = datetime()`
      partnerDb.run(stmt, [subjectType, String(subjectId), embeddingSpecId, contentHash, vector], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  /**
   * Delete a subject's vectors under every spec.
   * @returns {Promise<number>} number of rows deleted
   */
  embeddingDeleteBySubject(subjectType, subjectId) {
    return new Promise((resolve, reject) => {
      partnerDb.run(
        "DELETE FROM embedding WHERE subjectType = ? AND subjectId = ?",
        [subjectType, String(subjectId)],
        function(err) {
          if (err) {
            reject(err)
          } else {
            resolve(this.changes)
          }
        }
      )
    })
  }

  /**
   * @returns {Promise<Map<string, string>>} subjectId -> contentHash
   */
  embeddingHashes(subjectType, embeddingSpecId) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        "SELECT subjectId, contentHash FROM embedding WHERE subjectType = ? AND embeddingSpecId = ? AND chunkIndex = 0",
        [subjectType, embeddingSpecId],
        function(err, rows) {
          if (err) {
            reject(err)
          } else {
            resolve(new Map(rows.map(row => [row.subjectId, row.contentHash])))
          }
        }
      )
    })
  }

  /**
   * Vectors for the given subjects, or for all subjects of the type when subjectIds is null.
   * @param {string[]|null} subjectIds
   * @returns {Promise<Array<{subjectId: string, chunkIndex: number, contentHash: string, vector: Buffer}>>}
   */
  embeddingsBySubjects(subjectType, embeddingSpecId, subjectIds) {
    const columns = "subjectId, chunkIndex, contentHash, vector"
    if (subjectIds == null) {
      return new Promise((resolve, reject) => {
        partnerDb.all(
          `SELECT ${columns} FROM embedding WHERE subjectType = ? AND embeddingSpecId = ?`,
          [subjectType, embeddingSpecId],
          function(err, rows) {
            if (err) {
              reject(err)
            } else {
              resolve(rows)
            }
          }
        )
      })
    }
    return allInChunks(
      subjectIds.map(String),
      (placeholders) => `SELECT ${columns} FROM embedding
                         WHERE subjectType = ? AND embeddingSpecId = ? AND subjectId IN (${placeholders})`,
      [subjectType, embeddingSpecId]
    )
  }

  /**
   * One page of vectors ordered by subjectId (text order).
   * @param {string[]|null} subjectIds - restrict to these, or null for all
   * @param {string} afterId - return only subjectIds after this one
   * @returns {Promise<{data: Array<{subjectId, chunkIndex, contentHash, vector}>, hitLimit: boolean}>}
   */
  async embeddingsPaged(subjectType, embeddingSpecId, subjectIds, afterId, limit) {
    let rows
    if (subjectIds == null) {
      rows = await new Promise((resolve, reject) => {
        partnerDb.all(
          `SELECT subjectId, chunkIndex, contentHash, vector FROM embedding
           WHERE subjectType = ? AND embeddingSpecId = ? AND subjectId > ?
           ORDER BY subjectId, chunkIndex LIMIT ${limit}`,
          [subjectType, embeddingSpecId, afterId || ''],
          function(err, result) {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          }
        )
      })
    } else {
      // compare as text, like the SQL above, so paging works the same either way
      const pageIds = subjectIds.map(String).filter(id => id > (afterId || '')).sort().slice(0, limit)
      rows = await this.embeddingsBySubjects(subjectType, embeddingSpecId, pageIds)
      rows.sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : a.chunkIndex - b.chunkIndex))
    }
    return { data: rows, hitLimit: rows.length === limit }
  }

  /**
   * @returns {Promise<Array<{subjectType: string, count: number}>>}
   */
  embeddingCounts(embeddingSpecId) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        "SELECT subjectType, COUNT(*) AS count FROM embedding WHERE embeddingSpecId = ? GROUP BY subjectType",
        [embeddingSpecId],
        function(err, rows) {
          if (err) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )
    })
  }

  /**
   * Admitted group members with their profiles, for matching. Members without a
   * profile have null rowId and description.
   * @param {number} groupId - group_onboard.rowid
   * @returns {Promise<Array<{rowId: number|null, issuerDid: string, content: string, description: string|null}>>}
   */
  groupMembersWithProfiles(groupId) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        `SELECT p.rowid as rowId, m.issuerDid, m.content, p.description
         FROM group_onboard_member m
         LEFT JOIN user_profile p ON m.issuerDid = p.issuerDid
         WHERE m.groupId = ? AND m.admitted = 1`,
        [groupId],
        function(err, rows) {
          if (err) {
            reject(err)
          } else {
            resolve(rows || [])
          }
        }
      )
    })
  }

}

module.exports = { dbService: new PartnerDatabase() }
