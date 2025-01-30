const sqlite3 = require('sqlite3').verbose()

const partnerDbInfo = require('../../conf/flyway-partner.js')
const partnerDb = new sqlite3.Database(partnerDbInfo.fileLoc)
const util = require('./util')

const DEFAULT_LIMIT = 50

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

  groupOnboardInsert(issuerDid, name, expiresAt) {
    return new Promise((resolve, reject) => {
      const stmt = "INSERT INTO group_onboard (issuerDid, name, expiresAt) VALUES (?, ?, ?)"
      partnerDb.run(stmt, [issuerDid, name, expiresAt], function(err) {
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
      partnerDb.get("SELECT * FROM group_onboard WHERE issuerDid = ?", [issuerDid], function(err, row) {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  groupOnboardGetByRowId(rowId) {
    return new Promise((resolve, reject) => {
      partnerDb.get("SELECT * FROM group_onboard WHERE rowid = ?", [rowId], function(err, row) {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  groupOnboardGetAll() {
    return new Promise((resolve, reject) => {
      partnerDb.all("SELECT rowid as rowId, name, expiresAt FROM group_onboard", function(err, rows) {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  groupOnboardDelete(issuerDid) {
    return new Promise((resolve, reject) => {
      const stmt = "DELETE FROM group_onboard WHERE issuerDid = ?"
      partnerDb.run(stmt, [issuerDid], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
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

  groupOnboardUpdate(id, issuerDid, name) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard SET name = ? WHERE issuerDid = ? AND rowid = ?"
      partnerDb.run(stmt, [name, issuerDid, id], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberInsert(issuerDid, groupOnboard, content) {
    return new Promise((resolve, reject) => {
      const stmt = "INSERT INTO group_onboard_member (issuerDid, groupOnboard, content) VALUES (?, ?, ?)"
      partnerDb.run(stmt, [issuerDid, groupOnboard, content], function(err) {
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

  groupOnboardMemberUpdateContent(groupOnboardMemberId, content) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard_member SET content = ? WHERE rowid = ?"
      partnerDb.run(stmt, [content, groupOnboardMemberId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberUpdateAdmitted(groupOnboard, memberDid, admitted) {
    return new Promise((resolve, reject) => {
      const stmt = "UPDATE group_onboard_member SET admitted = ? WHERE issuerDid = ? AND groupOnboard = ?"
      partnerDb.run(stmt, [admitted ? 1 : 0, memberDid, groupOnboard], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }

  groupOnboardMemberGetById(groupOnboardMemberId) {
    return new Promise((resolve, reject) => {
      partnerDb.get(
        "SELECT * FROM group_onboard_member WHERE rowid = ?",
        [groupOnboardMemberId],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            resolve(row)
          }
        }
      )
    })
  }

  groupOnboardMembersByGroup(groupOnboard) {
    return new Promise((resolve, reject) => {
      partnerDb.all(
        "SELECT m.*, g.issuerDid as organizerDid FROM group_onboard_member m JOIN group_onboard g ON m.groupOnboard = g.rowid WHERE m.groupOnboard = ?",
        [groupOnboard],
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
            resolve()
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
        "SELECT * FROM user_profile WHERE rowid = ?",
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
        "SELECT rowid, * FROM user_profile WHERE issuerDid = ?",
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

  profilesByLocationAndContentsPaged(minLat, minLon, maxLat, maxLon, beforeRowId, afterRowId, claimContents) {
    return new Promise((resolve, reject) => {
      let whereClause = ""
      const params = []

      // Only add location conditions if all coordinates are defined
      if (minLat != null && minLon != null && maxLat != null && maxLon != null) {
        whereClause = "((locLat >= ? AND locLat <= ? AND locLon >= ? AND locLon <= ?) OR (locLat2 >= ? AND locLat2 <= ? AND locLon2 >= ? AND locLon2 <= ?))"
        params.push(minLat, maxLat, minLon, maxLon, minLat, maxLat, minLon, maxLon)
      }

      if (beforeRowId) {
        whereClause = (whereClause ? `${whereClause} AND ` : "") + "rowid < ?"
        params.push(beforeRowId)
      }
      if (afterRowId) {
        whereClause = (whereClause ? `${whereClause} AND ` : "") + "rowid > ?"
        params.push(afterRowId)
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

  profileDelete(issuerDid) {
    return new Promise((resolve, reject) => {
      const stmt = "DELETE FROM user_profile WHERE issuerDid = ?"
      partnerDb.run(stmt, [issuerDid], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.changes)
        }
      })
    })
  }
}

module.exports = { dbService: new PartnerDatabase() }
