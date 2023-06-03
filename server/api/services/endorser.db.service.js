const crypto = require('crypto')
const sqlite3 = require('sqlite3').verbose()
const ulidx = require('ulidx')
const ulid = ulidx.monotonicFactory()

const logger = require('../../common/logger')
const dbInfo = require('../../../conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)
const util = require('./util')



const DEFAULT_LIMIT = 50

const GREATER_THAN = "_greaterThan"
const GREATER_THAN_OR_EQUAL_TO = "_greaterThanOrEqualTo"
const LESS_THAN = "_lessThan"
const LESS_THAN_OR_EQUAL_TO = "_lessThanOrEqualTo"

export const MUST_FILTER_TOTALS_ERROR = 'MUST_FILTER_TOTALS_ON_PROJECT_OR_RECIPIENT'




function constructWhere(params, allowedColumns, claimContents, contentColumn, excludeConfirmations) {

  var whereClause = ""
  var paramArray = []

  for (var param in params) {
    var col = param
    var operator = "="
    if (col.endsWith(GREATER_THAN)) {
      col = col.substring(0, col.length - GREATER_THAN.length)
      operator = ">"
    } else if (col.endsWith(GREATER_THAN_OR_EQUAL_TO)) {
      col = col.substring(0, col.length - GREATER_THAN_OR_EQUAL_TO.length)
      operator = ">="
    } else if (col.endsWith(LESS_THAN)) {
      col = col.substring(0, col.length - LESS_THAN.length)
      operator = "<"
    } else if (col.endsWith(LESS_THAN_OR_EQUAL_TO)) {
      col = col.substring(0, col.length - LESS_THAN_OR_EQUAL_TO.length)
      operator = "<="
    }

    if (allowedColumns.includes(col)) {
      if (whereClause.length > 0) {
        whereClause += " AND"
      }

      if (params[param] && params[param].match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/)) {
        // treat dates differently for SQLite
        whereClause += " " + col + " " + operator + " datetime('" + params[param] + "')"
      } else {
        whereClause += " " + col + " " + operator + " ?"
        paramArray.push(params[param])
      }
    }
  }

  if (claimContents && contentColumn) {
    // allow multiple words
    const terms = claimContents.split(" ")
    for (const term of terms) {
      const trimmed = term.trim()
      if (trimmed.length > 0) {
        if (whereClause.length > 0) {
          whereClause += " AND"
        }
        whereClause += " INSTR(lower(" + contentColumn + "), lower(?))"
        paramArray.push(trimmed)
      }
    }
  }

  if (excludeConfirmations) {
    if (whereClause.length > 0) {
      whereClause += " AND"
    }
    whereClause += " claimType != 'AgreeAction'"
    // This is for "legacy Confirmation" and can be deprecated for any installations after this comment was written.
    whereClause += " AND claimType != 'Confirmation'"
  }

  if (whereClause.length > 0) {
    whereClause = " WHERE" + whereClause
  }
  return { clause: whereClause, params: paramArray }
}

function isoAndZonify(dateTime) {
  return dateTime == null ? dateTime : dateTime.replace(" ", "T") + "Z"
}


/**
   @param table is the table name
   @param searchableColumns are names of columns allowing comparison operations (<, =, >)
   @param otherResultColumns are names of other columns to return in result
   @param contentColumn is a text column that can be searched with 'claimContents'
   @param dateColumns are names of date columns which will be converted in result

   @param params is an object with a key-value for each column-value to filter, with some special keys:
   - 'claimContents' for text to look for inside claims
   - 'excludeConfirmations' if it should exclude any claimType of 'AgreeAction'
   - column + '_greaterThan[OrEqualTo]' for entries with column value greater than (or equal to) the supplied value
   - column + '_lessThan[OrEqualTo]' for entries with column value less than (or equal to) the supplied value
   @param afterIdInput (optional) is the start of the search (excluding that item)
   @param beforeIdInput (optional) is the end of the search (excluding that item)

   @return Promise of object with "data" as a list of results, reverse-chronologically,
     with optional "hitlimit" boolean telling if we hit the limit count for this query
**/
function tableEntriesByParamsPaged(table, idColumn, searchableColumns, otherResultColumns,
                                   contentColumn, dateColumns,
                                   params, afterIdInput, beforeIdInput) {

  let claimContents = params.claimContents
  // note that value of '' is hard to detect (which is why this isn't conditional)
  delete params.claimContents
  let excludeConfirmations = params.excludeConfirmations
  delete params.excludeConfirmations
  let where = constructWhere(
    params,
    searchableColumns,
    claimContents,
    contentColumn,
    excludeConfirmations
  )
  let allClause = where.clause
  let allParams = where.params
  if (afterIdInput) {
    if (allClause) {
      allClause = allClause + ' AND ' + idColumn + ' > ?'
    } else {
      allClause = ' WHERE ' + idColumn + ' > ?'
    }
    allParams = allParams.concat([afterIdInput])
  }
  if (beforeIdInput) {
    if (allClause) {
      allClause = allClause + ' AND ' + idColumn + ' < ?'
    } else {
      allClause = ' WHERE ' + idColumn + ' < ?'
    }
    allParams = allParams.concat([beforeIdInput])
  }

  let rowErr
  return new Promise((resolve, reject) => {
    var data = []
    const sql =
          "SELECT rowid, * FROM " + table
          + allClause + " ORDER BY " + idColumn + " DESC LIMIT " + DEFAULT_LIMIT
    db.each(sql,
      allParams,
      function(err, row) {
        if (err) {
          rowErr = err
        } else {
          var fieldNames =
              searchableColumns.concat(otherResultColumns).concat([contentColumn])
          const result = {}
          for (let field of fieldNames) {
            if (row[field] === undefined) {
              logger.error(`DB field reference ${field} was not found in results.`)
            }
            result[field] =
              dateColumns.includes(field) ? isoAndZonify(row[field]) : row[field]
          }
          data.push(result)
        }
      },
      function(allErr, num) {
        if (rowErr || allErr) {
          reject(rowErr || allErr)
        } else {
          const result = { data: data }
          if (num === DEFAULT_LIMIT) {
            result['hitLimit'] = true
          }
          resolve(result)
        }
      }
    )
  })
}


class EndorserDatabase {

  ALL_SUBJECT_MATCH() {
    return "*"
  }

  constructor() {
    /** I feel like we should stop the DB, but this gets run twice on a kill and throws an error for some reason.
        Well, it doesn't look like it hurts anything to CTRL-C.
        We just have to find a better way on the server because a process kill leaves things hanging around.

    process.on('SIGINT', () => {
      db.close()
      console.log("Stopped DB.")
    })
    **/
  }


  newUlid() {
    return ulid()
  }



  /****************************************************************
   * Action
   **/

  actionClaimById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM action_claim WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          row.eventStartTime = isoAndZonify(row.eventStartTime)
          resolve({id:row.rowid, agentDid:row.agentDid, jwtId:row.jwtId, eventId:row.eventRowId,
                   eventOrgName:row.eventOrgName, eventName:row.eventName, eventStartTime:row.eventStartTime})
        } else {
          resolve(null)
        }
      })
    })
  }

  actionClaimByDidEventId(agentDid, eventId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM action_claim WHERE agentDid = ? AND eventRowId = ?",
        [agentDid, eventId],
        function(err, row) {
          if (err) { reject(err) } else { resolve(row) }
        })
    })
  }

  /**
     @param object with a key-value for each column-value to filter
   **/
  actionClaimsByParams(params) {
    let where = constructWhere(
      params,
      ['jwtId','issuerDid','agentDid','eventRowId','eventOrgName','eventName','eventStartTime']
    )
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT rowid, * FROM action_claim" + where.clause + " ORDER BY rowid DESC LIMIT 50"
      db.each(sql, where.params, function(err, row) {

        row.id = row.rowid
        delete row.rowid
        row.eventId = row.eventRowId
        delete row.eventRowId
        row.eventStartTime = isoAndZonify(row.eventStartTime)

        data.push(row)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
     @param eventId
     @returns all actions on the event outer-joined with confirmations of those actions
   **/
  retrieveActionClaimsAndConfirmationsByEventId(eventId) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT a.rowid AS aid, a.agentDid AS actionAgentDid, a.eventRowId, a.eventOrgName, a.eventName, a.eventStartTime, c.rowid AS cid, c.issuer AS confirmDid, c.actionRowId FROM action_claim a LEFT JOIN confirmation c ON c.actionRowId = a.rowid WHERE a.eventRowId = ?", [eventId], function(err, row) {
        let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, actionRowId:row.actionRowId} : null
        let both =
            {action:{id:row.aid, agentDid:row.actionAgentDid, eventRowId:row.eventRowId}, confirmation:confirmation}
        data.push(both)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
     @param eventId
     @returns all actions on the event outer-joined with confirmations of those actions

     Result format is: { action: { id, agentDid, eventRowId }, confirmation: { id, issuer, actionRowId } }
     ... where 'confirmation' may be null.
   **/
  retrieveActionClaimsAndConfirmationsByEventData(orgName, name, startTime) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT a.rowid AS aid, a.agentDid AS actionAgentDid, a.eventRowId, a.eventOrgName, a.eventName, a.eventStartTime, c.rowid AS cid, c.issuer AS confirmDid, c.actionRowId FROM action_claim a LEFT JOIN confirmation c ON c.actionRowId = a.rowid WHERE a.eventOrgName = ? AND a.eventName = ? AND a.eventStartTime = datetime(?)",
        [orgName, name, startTime],
        function(err, row) {
          let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, actionRowId:row.actionRowId} : null
          let both = {
            action: {id:row.aid, agentDid:row.actionAgentDid, eventRowId:row.eventRowId},
            confirmation: confirmation,
          }
        data.push(both)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
     @param dateTimeStr in ISO format
     @Returns all actions on the event outer-joined with confirmations of those actions
  **/
  retrieveActionClaimsAndConfirmationsForEventsSince(dateTimeStr) {
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT a.rowid AS aid, a.agentDid AS actionAgentDid, a.eventRowId, a.eventOrgName, a.eventName, a.eventStartTime, c.rowid AS cid, c.issuer AS confirmDid, c.actionRowId FROM action_claim a LEFT JOIN confirmation c ON c.actionRowId = a.rowid WHERE a.eventStartTime >= datetime(?)"
      db.each(sql, [dateTimeStr], function(err, row) {
        row.eventStartTime = isoAndZonify(row.eventStartTime)
        let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, actionId:row.actionRowId} : null
        let both = {
          action: {id:row.aid, agentDid:row.actionAgentDid, eventId:row.eventRowId, eventOrgName:row.eventOrgName,
                   eventName:row.eventName, eventStartTime:row.eventStartTime},
          confirmation: confirmation,
        }
        data.push(both)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  actionClaimInsert(issuerDid, agentDid, jwtId, event) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO action_claim (jwtId, issuerDid, agentDid, eventRowId, eventOrgName, eventName, eventStartTime) VALUES (?, ?, ?, ?, ?, ?, datetime(?))");
      db.run(stmt, [jwtId, issuerDid, agentDid, event.id, event.orgName, event.name, event.startTime], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }




  /****************************************************************
   * Confirmation
   **/

  confirmationById(confirmationId) {
    return new Promise((resolve, reject) => {
      var data = []
      const sql = "SELECT rowid, * FROM confirmation WHERE rowid = ?"
      db.each(sql, [confirmationId], function(err, row) {
        data.push({issuer: row.issuer, origClaim: row.origClaim})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  confirmationByIssuerAndAction(issuerDid, actionRowId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM confirmation WHERE issuer = ? AND actionRowId = ?",
        [issuerDid, actionRowId],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({id:row.rowid, jwtId:row.jwtId, issuer:row.issuer, actionId:row.actionRowId})
          } else {
            resolve(null)
          }
        })
    })
  }

  confirmationByIssuerAndJwtId(issuerDid, origClaimJwtId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM confirmation WHERE issuer = ? AND origClaimJwtId = ?",
        [issuerDid, origClaimJwtId],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({id:row.rowid, jwtId:row.jwtId, issuerDid:row.issuer})
          } else {
            resolve(null)
          }
        })
    })
  }

  /** inefficient: searches full claim
  confirmationByIssuerAndOrigClaim(issuerDid, claim) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM confirmation WHERE issuer = ? AND origClaim = ?",
        [issuerDid, claim],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({id:row.rowid, jwtId:row.jwtId})
          } else {
            resolve(null)
          }
        })
    })
  }
  **/

  confirmationByIssuerAndOrgRole(issuerDid, orgRoleRowId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM confirmation WHERE issuer = ? AND orgRoleRowId = ?",
        [issuerDid, orgRoleRowId],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({id:row.rowid, jwtId:row.jwtId, issuerDid:row.issuer, orgRoleId:row.orgRoleRowId})
          } else {
            resolve(null)
          }
        })
    })
  }

  confirmationByIssuerAndTenure(issuerDid, tenureRowId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM confirmation WHERE issuer = ? AND tenureRowId = ?",
        [issuerDid, tenureRowId],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve({id:row.rowid, jwtId:row.jwtId, issuerDid:row.issuer, tenureId:row.tenureRowId})
          } else {
            resolve(null)
          }
        })
    })
  }

  /** inefficient: searches full claim
  confirmationsByClaim(claimStr) {
    return new Promise((resolve, reject) => {
      var data = []
      const sql = "SELECT issuer FROM confirmation WHERE origClaim = ?"
      db.each(sql, [claimStr], function(err, row) {
        data.push({issuer: row.issuer})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
  **/

  /** see notes on previous usage in jwt.service.js
  confirmationsByActionClaim(actionRowId) {
    return new Promise((resolve, reject) => {
      var data = []
      const sql = "SELECT rowid, * FROM confirmation WHERE actionRowId = ?"
      db.each(sql, [actionRowId], function(err, row) {
        data.push({issuer:row.issuer})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  confirmationsByTenureClaim(tenureRowId) {
    return new Promise((resolve, reject) => {
      var data = []
      const sql = "SELECT rowid, * FROM confirmation WHERE tenureRowId = ?"
      db.each(sql, [tenureRowId], function(err, row) {
        data.push({issuer:row.issuer})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
        })
  }
  **/

  confirmationInsert(issuer, jwtId, origJwtId, origClaim, origClaimCanonHashBase64, actionRowId, tenureRowId, orgRoleRowId) {
    return new Promise((resolve, reject) => {
      var stmt = (
          "INSERT INTO confirmation"
          + " (jwtId, issuer, origClaimJwtId, origClaim, origClaimCanonHashBase64, actionRowId, tenureRowId, orgRoleRowId)"
          + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      db.run(
        stmt,
        [jwtId, issuer, origJwtId, origClaim, origClaimCanonHashBase64, actionRowId, tenureRowId, orgRoleRowId],
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

  // take JWT IDs and return all the issuer DIDs who have confirmed those claims
  confirmersForClaims(claimEntryIds) {
    return new Promise((resolve, reject) => {
      var data = []
      const inListStr = claimEntryIds.map(x => "?").join(',')
      const sql = "SELECT rowid, * FROM confirmation WHERE origClaimJwtId in (" + inListStr + ")"
      db.each(sql, claimEntryIds, function(err, row) {
        data.push(row.issuer)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }




  /****************************************************************
   * Event
   **/

  eventById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid, orgName, name, startTime FROM event WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          row.startTime = isoAndZonify(row.startTime)
          resolve({id:row.rowid, orgName:row.orgName, name:row.name, startTime:row.startTime})
        } else {
          resolve(null)
        }
      })
    })
  }

  /**
     @param object with a key-value for each column-value to filter
   **/
  eventsByParams(params) {
    let where = constructWhere(params, ['orgName', 'name', 'startTime'])
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT rowid, orgName, name, startTime FROM event" + where.clause + " ORDER BY startTime DESC LIMIT 50"
      db.each(sql, where.params, function(err, row) {
        row.startTime = isoAndZonify(row.startTime)
        data.push({id:row.rowid, orgName:row.orgName, name:row.name, startTime:row.startTime})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  eventInsert(orgName, name, startTime) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO event (orgName, name, startTime) VALUES (?, ?, datetime(?))");
      db.run(stmt, [orgName, name, startTime], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }










  /****************************************************************
   * Give
   **/

  giveInfoByHandleId(handleId) {
    return new Promise((resolve, reject) => {
      db.get(
          "SELECT * FROM give_claim WHERE handleId = ?",
          [handleId],
          function(err, row) {
            if (err) {
              reject(err)
            } else {
              if (row?.issuedAt) { row.issuedAt = isoAndZonify(row.issuedAt) }
              if (row?.updatedAt) { row.updatedAt = isoAndZonify(row.updatedAt) }
              resolve(row)
            }
          }
      )
    })
  }

  giveInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt =
          "INSERT INTO give_claim (jwtId, handleId, issuedAt, updatedAt"
          + ", agentDid"
          + ", recipientDid, fulfillsId, fulfillsType, fulfillsPlanId"
          + ", amountConfirmed, amount, unit, description, fullClaim)"
          + " VALUES (?, ?, datetime(?), datetime(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      db.run(
        stmt,
        [
          entry.jwtId, entry.handleId, entry.issuedAt, entry.updatedAt,
          entry.agentDid,
          entry.recipientDid, entry.fulfillsId, entry.fulfillsType,
          entry.fulfillsPlanId, entry.amountConfirmed,
          entry.amount, entry.unit, entry.description, entry.fullClaim
        ],
        function(err) { if (err) { reject(err) } else { resolve(entry.jwtId) } })
    })
  }

  // Returns Promise of { data: [], hitLimit: true|false }
  givesByParamsPaged(params, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'give_claim',
      'jwtId',
      ['jwtId', 'handleId', 'updatedAt', 'agentDid', 'recipientDid',
       'fulfillsId', 'fulfillsType', 'fulfillsPlanId', 'amountConfirmed'],
      ['issuedAt', 'amount', 'fullClaim', 'unit'],
      'description',
      ['issuedAt', 'updatedAt'],
      params,
      afterIdInput,
      beforeIdInput
    )
  }

  /**
     Start after afterIdInput (optional) and before beforeIdinput (optional)
     and retrieve all gives for planId in reverse chronological order.
  **/
  givesForPlansPaged(planIds, afterIdInput, beforeIdInput) {
    return new Promise((resolve, reject) => {
      const inListStr = planIds.map(value => "?").join(',')
      let whereClause =
          " fulfillsPlanId in (" + inListStr + ")"

      let allParams = planIds.map(util.globalId)

      if (afterIdInput) {
        whereClause += ' AND ? < jwtId'
        allParams = allParams.concat([afterIdInput])
      }
      if (beforeIdInput) {
        whereClause += ' AND jwtId < ?'
        allParams = allParams.concat([beforeIdInput])
      }

      let data = []
      let rowErr
      const sql =
            "SELECT * FROM give_claim WHERE"
            + whereClause
            + " ORDER BY jwtId DESC LIMIT " + DEFAULT_LIMIT
      db.each(
        sql,
        allParams,
        function(err, row) {
          if (err) {
            rowErr = err
          } else {
            row.issuedAt = isoAndZonify(row.issuedAt)
            row.validThrough = isoAndZonify(row.validThrough)
            data.push(row)
          }
        },
        function(allErr, num) {
          if (rowErr || allErr) {
            reject(rowErr || allErr)
          } else {
            const result = { data: data }
            if (num === DEFAULT_LIMIT) {
              result["hitLimit"] = true
            }
            resolve(result)
          }
        }
      )
    })
  }

  giveTotals(agentId, recipientDid, planId, unit, includeTrades, afterIdInput, beforeIdInput) {
    return new Promise((resolve, reject) => {
      let allParams = []
      let whereClause = ''
      if (agentId) {
        whereClause += whereClause ? ' AND' : '' // because I copy-paste this stuff :-)
        whereClause += ' agentDid = ?'
        allParams = allParams.concat([agentId])
      }
      if (planId) {
        whereClause += whereClause ? ' AND' : ''
        whereClause += ' fulfillsPlanId = ?'
        allParams = allParams.concat([planId])
      }
      if (recipientDid) {
        whereClause += whereClause ? ' AND' : ''
        whereClause += ' recipientDid = ?'
        allParams = allParams.concat([recipientDid])
      }

      // must have at least one of the above
      if (!whereClause) {
        reject(MUST_FILTER_TOTALS_ERROR)
      }
      if (unit) {
        whereClause += ' AND unit = ?'
        allParams = allParams.concat([unit])
      }
      if (!includeTrades) {
        whereClause += " AND fulfillsType != 'TradeAction'"
      }
      if (afterIdInput) {
        whereClause = ' AND jwtId > ?'
        allParams = allParams.concat([afterIdInput])
      }
      if (beforeIdInput) {
        whereClause += ' AND jwtId < ?'
        allParams = allParams.concat([beforeIdInput])
      }
      whereClause = ' WHERE' + whereClause + ' AND unit IS NOT null'

      let data = {}
      let rowErr
      const sql =
            "SELECT unit, sum(amount) as total FROM give_claim" + whereClause
            + " GROUP BY unit"
      db.each(
        sql,
        allParams,
        function(err, row) {
          if (err) { rowErr = err } else { data[row.unit] = row.total }
        },
        function(allErr, num) {
          if (rowErr || allErr) {
            reject(rowErr || allErr)
          } else {
            resolve({ data: data })
          }
        }
      )
    })
  }

  giveUpdate(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
          "UPDATE give_claim set jwtId = ?"
          + ", issuedAt = datetime(?), updatedAt = datetime(?)"
          + ", agentDid = ?, recipientDid = ?"
          + ", fulfillsId = ?, fulfillsType = ?, fulfillsPlanId = ?"
          + ", unit = ?, amount = ?"
          + ", description = ?, fullClaim = ?"
          + " WHERE handleId = ?"
      )
      db.run(stmt, [
        entry.jwtId, entry.issuedAt, entry.updatedAt,
        entry.agentDid, entry.recipientDid,
        entry.fulfillsId, entry.fulfillsType, entry.fulfillsPlanId,
        entry.unit, entry.amount, entry.description, entry.fullClaim,
        entry.handleId,
      ], function(err) {
        if (!err && this.changes === 1) {
          resolve()
        } else {
          reject("Expected to update 1 give row but updated " + this.changes + " with error: " + err)
        }
      })
    })
  }

  giveUpdateConfirmed(handleId, amount, updatedTime) {
    return new Promise((resolve, reject) => {
      var stmt =
          "UPDATE give_claim SET amountConfirmed = amountConfirmed + ?," +
          " updatedAt = datetime(?) WHERE handleId = ?"
      db.run(
        stmt,
        [amount, updatedTime, handleId],
        function(err) { if (err) { reject(err) } else { resolve(this.changes) } })
    })
  }











  /****************************************************************
   * Give_Provider, a join table between gives & their providers
   **/

  giveProviderInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "INSERT INTO give_provider"
        + " (giveHandleId, providerHandleId)"
        + " VALUES (?, ?)"
      );
      db.run(
        stmt,
        [entry.giveHandleId, entry.providerHandleId],
        function(err) {
          if (err) { reject(err) } else { resolve(this.lastID) }
        })
    })
  }

  /**
   *
   * @param giveHandleId
   * @param afterId
   * @param beforeId
   * @returns { data, hitLimit } ... but note that there may be duplicates
   * because there some claims may have updated a provider (ie. same handleId)
   */
  giveProviderClaims(giveHandleId, afterIdInput, beforeIdInput) {
    const afterId = afterIdInput ? ' AND jwtId > ' + afterIdInput : ''
    const beforeId = beforeIdInput ? ' AND jwtId < ' + beforeIdInput : ''
    const whereClause =
      ' LEFT JOIN give_provider'
      + ' ON give_provider.providerHandleId = jwt.handleId'
      + ' WHERE give_provider.giveHandleId = ?'
      + ' AND give_provider.providerHandleId IS NOT NULL'
      + afterId
      + beforeId
    return this.jwtsByWhere(whereClause, [giveHandleId]).then(jwts => {
      const result = { data: jwts }
      if (jwts.length === DEFAULT_LIMIT) {
        result["hitLimit"] = true
      }
      return result
    })
  }

  giveProviderDelete(giveId) {
    return new Promise((resolve, reject) => {
      var stmt = "DELETE FROM give_provider WHERE giveHandleId = ?";
      db.run(
        stmt,
        [giveId],
        function(err) {
          if (err) { reject(err) } else { resolve() }
        })
    })
  }













  /****************************************************************
   * JWT
   **/

  /**
   *
   * @param payload
   * @param id
   * @param handleId
   * @param claim
   * @param claimStr a canonicalized string of the claim
   * @param claimEncoded
   * @param jwtEncoded
   * @returns {{claim: string, claimCanonHashBase64: string, claimContext: string, claimEncoded: string, claimType: string, handleId: string, hashHex: string, hashNonce: string, id: string, issuedAt: ISO-date-string, issuer: string, jwtEncoded: string, subject: string}}
   */
  buildJwtEntry(payload, id, handleId, claim, claimStr, claimEncoded, jwtEncoded) {
    const claimCanonHash =
      crypto.createHash('sha256').update(claimStr).digest('base64')
    const claimContext = claim['@context']
    const claimType = claim['@type']
    // 144 bits, base64 >= 128 bits with all character space (no padding chars)
    const hashNonce = crypto.randomBytes(18).toString('base64')
    const hashHex = util.hashedClaimWithHashedDids({nonce: hashNonce, claim: claimStr})
    const issuedAt = new Date(payload.iat * 1000).toISOString()
    const issuer = payload.iss
    const subject = payload.sub
    return {
      claim: claimStr,
      claimCanonHashBase64: claimCanonHash,
      claimContext: claimContext,
      claimEncoded: claimEncoded,
      claimType: claimType,
      handleId: handleId,
      hashHex: hashHex,
      hashNonce: hashNonce,
      id: id,
      issuedAt: issuedAt,
      issuer: issuer,
      jwtEncoded: jwtEncoded,
      subject: subject,
    }
  }

  jwtById(id) {
    return new Promise((resolve, reject) => {
      var data = null
      db.each(
        "SELECT id, issuedAt, issuer, subject, claimContext, claimType, claim, handleId, claimEncoded, jwtEncoded, hashHex, hashChainHex FROM jwt WHERE id = ?",
        [id],
        function(err, row) {
          row.issuedAt = isoAndZonify(row.issuedAt)
          data = {
            id: row.id, issuedAt: row.issuedAt, issuer: row.issuer, subject: row.subject,
            claimContext: row.claimContext, claimType: row.claimType, claim: row.claim,
            handleId: row.handleId,
            claimEncoded: row.claimEncoded, jwtEncoded: row.jwtEncoded,
            hashHex: row.hashHex, hashChainHex: row.hashChainHex
          }
        }, function(err, num) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
    })
  }

  jwtCountByAfter(issuer, time) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT count(*) as numJwts FROM jwt WHERE issuer = ? AND datetime(?) < issuedAt",
        [issuer, time],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve(row.numJwts)
          } else {
            // should never happen
            reject('Got no result from JWT count query.')
          }
        })
    })
  }

  jwtsByWhere(whereClause, whereParams) {
    return new Promise((resolve, reject) => {
      let data = [], rowErr
      const sql =
        "SELECT id, issuedAt, issuer, subject, claimContext, claimType, claim,"
        + " handleId, hashHex, hashChainHex FROM jwt"
        + whereClause + " ORDER BY id DESC LIMIT " + DEFAULT_LIMIT
      //console.log('jwtsByWhere params & sql: ', whereParams, sql)
      db.each(
        // don't include things like claimEncoded & jwtEncoded because they contain all info (not hidden later)
        sql,
        whereParams,
        function(err, row) {
          if (err) {
            rowErr = err
          } else {
            row.issuedAt = isoAndZonify(row.issuedAt)
            data.push({
              id:row.id, issuedAt:row.issuedAt, issuer:row.issuer, subject:row.subject,
              claimContext:row.claimContext, claimType:row.claimType, claim:row.claim,
              handleId: row.handleId,
              hashHex:row.hashHex, hashChainHex:row.hashChainHex
            })
          }
        },
        function(err, num) {
          if (rowErr || err) { reject(rowErr || err) } else { resolve(data) }
        })
    })
  }

  /**
     Similar to jwtsByParamsPaged, but:
     - returns Promise of array of the results
   **/
  jwtsByParams(params) {

    // Note: this is very similar logic to jwtsByParamsPaged

    let claimContents = params.claimContents
    delete params.claimContents // note that value of '' is hard to detect (which is why this isn't conditional)
    let excludeConfirmations = params.excludeConfirmations
    delete params.excludeConfirmations
    let where = constructWhere(
      params,
      ['id', 'issuedAt', 'issuer', 'subject', 'claimType', 'handleId', 'hashHex', 'hashChainHex'],
      claimContents,
      'claim',
      excludeConfirmations
    )
    return this.jwtsByWhere(where.clause, where.params)
  }

  /**
     See tableEntriesByParamsPaged
     Returns Promise of { data: [], hitLimit: true|false }
   **/
  jwtsByParamsPaged(params, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'jwt',
      'id',
      ['id', 'issuedAt', 'issuer', 'subject', 'claimType', 'handleId', 'hashHex', 'hashChainHex'],
      ['claimContext', 'claim'],
      'claim',
      ['issuedAt'],
      params,
      afterIdInput,
      beforeIdInput
    )
  }

  /**
     @param full claim text to find
  **/
  /** unused, and very inefficient so not recommended until we have a good canonical comparison; see taskyaml:endorser.ch,2020/tasks#disallow-duplicate
  jwtByClaim(claimStr) {
    return new Promise((resolve, reject) => {
      var data = []
      // don't include things like claimEncoded & jwtEncoded because they contain all info (not hidden later)
      db.each("SELECT id, issuedAt, issuer, subject, claimContext, claimType, claim, handleId, hashHex, hashChainHex FROM jwt WHERE claim = ?", [claimStr], function(err, row) {
        row.issuedAt = isoAndZonify(row.issuedAt)
        data.push({id:row.id, issuedAt:row.issuedAt, issuer:row.issuer, subject:row.subject, claimContext:row.claimContext, claimType:row.claimType, claim:row.claim, handleId:row.handleId, hashHex:row.hashHex, hashChainHex:row.hashChainHex})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }
  **/

  jwtInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt =
        "INSERT INTO jwt (id, issuedAt, issuer, subject, claim, claimCanonHashBase64, claimContext, claimEncoded, claimType, handleId, hashHex, hashNonce, jwtEncoded)"
        + " VALUES (?, datetime(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      db.run(
        stmt,
        [
          entry.id, entry.issuedAt, entry.issuer, entry.subject,
          entry.claim, entry.claimCanonHashBase64, entry.claimContext, entry.claimEncoded, entry.claimType,
          entry.handleId, entry.hashHex, entry.hashNonce, entry.jwtEncoded
        ],
        function(err) {
          if (err) { reject(err) } else { resolve(this.lastID) }
        })
    })
  }

  /**
   *
   * This can be useful when cleaning up data, but otherwise we don't edit previous records.
   *
  jwtUpdateClaimFields(entry) {
    return new Promise((resolve, reject) => {
      var stmt = ("UPDATE jwt SET claimType = ?, claimContext = ?, claim = ?, claimEncoded = ? WHERE id = ?")
      db.run(
        stmt,
        [entry.claimType, entry.claimContext, entry.claim, entry.claimEncoded, entry.id],
        function(err) {
          if (err) {
            reject(err)
          } else {
            if (this.changes === 1) {
              resolve()
            } else {
              reject("Expected to update 1 jwt row but updated " + this.changes)
            }
          }
        })
    })
  }
  **/

  /**
     Start after afterIdInput (optional) and before beforeIdinput (optional)
     and retrieve all claims by issuerDid with claimTypes
     in reverse chronological order.
  **/
  jwtIssuerClaimTypesPaged(issuerDid, claimTypes, afterIdInput, beforeIdInput) {
    return new Promise((resolve, reject) => {
      const inListStr = claimTypes.map(value => "?").join(',')
      let allParams = [issuerDid].concat(claimTypes)

      let moreClause = ''
      if (afterIdInput) {
        moreClause = ' id > ? AND'
        allParams = [afterIdInput].concat(allParams)
      }
      if (beforeIdInput) {
        moreClause = ' id < ? AND' + moreClause
        allParams = [beforeIdInput].concat(allParams)
      }

      let data = []
      let rowErr
      db.each(
        // don't include things like claimEncoded & jwtEncoded
        // because they contain all info (not hidden later)
        "SELECT id, issuedAt, issuer, subject, claimContext, claimType, claim"
          + ", handleId, hashHex, hashChainHex FROM jwt WHERE" + moreClause
          + " issuer = ? AND claimType in (" + inListStr + ")"
          + " ORDER BY id DESC LIMIT " + DEFAULT_LIMIT,
        allParams,
        function(err, row) {
          if (err) {
            rowErr = err
          } else {
            row.issuedAt = isoAndZonify(row.issuedAt)
            data.push({
              id: row.id, issuedAt: row.issuedAt, issuer: row.issuer,
              subject: row.subject, claimContext: row.claimContext,
              claimType: row.claimType, claim: row.claim,
              handleId: row.handleId, hashHex: row.hashHex,
              hashChainHex: row.hashChainHex
            })
          }
        },
        function(allErr, num) {
          if (rowErr || allErr) {
            reject(rowErr || allErr)
          } else {
            const result = { data: data }
            if (num === DEFAULT_LIMIT) {
              result["hitLimit"] = true
            }
            resolve(result)
          }
        }
      )
    })
  }

  /**
   *
   * @param identifier
   * @returns {Promise<unknown>} the JWT entry with no post-processing
   */
  jwtLastByHandleIdRaw(identifier) {
    return new Promise((resolve, reject) => {
      db.get(
        // don't include things like claimEncoded & jwtEncoded because they contain all info (not hidden later)
        "SELECT id, issuedAt, issuer, subject, claimContext, claimType, claim, handleId, hashHex, hashChainHex"
        + " FROM jwt WHERE handleId = ? ORDER BY id DESC LIMIT 1",
        [identifier],
        function(err, row) { if (err) { reject(err) } else { resolve(row) } })
    })
  }

  /**
   * Retrieve the JWT entry but format the date as ISO.
   */
  jwtLastByHandleId(identifier) {
    return this.jwtLastByHandleIdRaw(identifier)
      .then(row => {
        if (row) {
          row.issuedAt = isoAndZonify(row.issuedAt)
        }
        return row
      })
  }

  jwtLastMerkleHash() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT hashChainHex FROM jwt WHERE hashChainHex is not null ORDER BY id DESC LIMIT 1",
        [],
        function(err, row) {
          data.push({hashChainHex:row.hashChainHex})
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        });
    })
  }

  jwtClaimsAndNoncesUnmerkled() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT id, claim, hashHex, hashNonce FROM jwt WHERE hashChainHex is null ORDER BY id",
        [],
        function(err, row) {
          data.push({id:row.id, claim:row.claim, hashHex:row.hashHex, hashNonce:row.hashNonce})
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        });
    })
  }

  jwtSetHash(jwtId, hashHex) {
    return new Promise((resolve, reject) => {
      var stmt = ("UPDATE jwt SET hashHex = ? WHERE id = ?");
      db.run(
        stmt,
        [hashHex, jwtId],
        function(err) {
          if (err) {
            reject(err)
          } else {
            if (this.changes === 1) {
              resolve(hashHex)
            } else {
              reject("Expected to update 1 jwt row but updated " + this.changes)
            }
          }
        })
    })
  }

  jwtSetMerkleHash(jwtId, hashHex, hashChainHex) {
    return new Promise((resolve, reject) => {
      var stmt = ("UPDATE jwt SET hashHex = ?, hashChainHex = ? WHERE id = ?");
      db.run(stmt, [hashHex, hashChainHex, jwtId], function(err) {
        if (err) {
          reject(err)
        } else {
          if (this.changes === 1) {
            resolve(hashHex)
          } else {
            reject("Expected to update 1 jwt row but updated " + this.changes)
          }
        }
      })
    })
  }









  /****************************************************************
   * Offer
   **/

  offerInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt =
          "INSERT INTO offer_claim (jwtId, handleId, issuedAt, updatedAt"
          + ", offeredByDid"
          + ", recipientDid, recipientPlanId, amount, unit, objectDescription"
          + ", validThrough, fullClaim)"
          + " VALUES"
          + " (?, ?, datetime(?), datetime(?), ?, ?, ?, ?, ?, ?, datetime(?), ?)"
      db.run(
        stmt,
        [
          entry.jwtId, entry.handleId, entry.issuedAt, entry.updatedAt,
          entry.offeredByDid,
          entry.recipientDid, entry.recipientPlanId, entry.amount, entry.unit,
          entry.objectDescription, entry.validThrough, entry.fullClaim
        ],
        function(err) { if (err) { reject(err) } else { resolve(entry.jwtId) } })
    })
  }

  // Returns Promise of { data: [], hitLimit: true|false }
  offersByParamsPaged(params, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'offer_claim',
      'jwtId',
      ['jwtId', 'handleId', 'updatedAt', 'offeredByDid', 'recipientDid',
        'recipientPlanId', 'validThrough'],
      ['amount', 'unit', 'amountGiven', 'amountGivenConfirmed',
       'nonAmountGivenConfirmed', 'fullClaim'],
      'objectDescription',
      ['issuedAt', 'updatedAt', 'validThrough'],
      params,
      afterIdInput,
      beforeIdInput
    )
  }

  /**
     Start after afterIdInput (optional) and before beforeIdinput (optional)
     and retrieve all offers for planId in reverse chronological order.

     Returns Promise of { data: [], hitLimit: true|false }
  **/
  offersForPlansPaged(planIds, afterIdInput, beforeIdInput) {
    return new Promise((resolve, reject) => {
      const inListStr = planIds.map(value => "?").join(',')
      let allParams = planIds.map(util.globalId)

      let whereClause = " recipientPlanId in (" + inListStr + ")"

      if (afterIdInput) {
        whereClause += ' AND ? < jwtId'
        allParams = allParams.concat([afterIdInput])
      }
      if (beforeIdInput) {
        whereClause += ' AND jwtId < ?'
        allParams = allParams.concat([beforeIdInput])
      }

      let data = []
      let rowErr
      const sql =
            "SELECT jwtId, handleId, issuedAt, offeredByDid, amount, unit"
            + ", objectDescription, validThrough, fullClaim FROM offer_claim WHERE"
            + whereClause
            + " ORDER BY jwtId DESC LIMIT " + DEFAULT_LIMIT
      db.each(
        sql,
        allParams,
        function(err, row) {
          if (err) {
            rowErr = err
          } else {
            row.issuedAt = isoAndZonify(row.issuedAt)
            row.validThrough = isoAndZonify(row.validThrough)
            data.push(row)
          }
        },
        function(allErr, num) {
          if (rowErr || allErr) {
            reject(rowErr || allErr)
          } else {
            const result = { data: data }
            if (num === DEFAULT_LIMIT) {
              result["hitLimit"] = true
            }
            resolve(result)
          }
        }
      )
    })
  }

  offerTotals(planId, recipientDid, unit, afterIdInput, beforeIdInput) {
    return new Promise((resolve, reject) => {
      let allParams = []
      let whereClause = ''
      if (planId) {
        whereClause += ' recipientPlanId = ?'
        allParams = allParams.concat([planId])
      }
      if (recipientDid) {
        whereClause += whereClause ? ' AND' : ''
        whereClause += ' recipientDId = ?'
        allParams = allParams.concat([recipientDid])
      }
      if (!whereClause) {
        reject(MUST_FILTER_TOTALS_ERROR)
      }
      if (unit) {
        whereClause += whereClause ? ' AND' : ''
        whereClause += ' unit = ?'
        allParams = allParams.concat([unit])
      }
      if (afterIdInput) {
        whereClause += whereClause ? ' AND' : ''
        whereClause = ' jwtId > ?'
        allParams = allParams.concat([afterIdInput])
      }
      if (beforeIdInput) {
        whereClause += whereClause ? ' AND' : ''
        whereClause += ' jwtId < ?'
        allParams = allParams.concat([beforeIdInput])
      }
      whereClause = ' WHERE' + whereClause + ' AND unit IS NOT null'

      let data = {}
      let rowErr
      const sql =
        "SELECT unit, sum(amount) as total FROM offer_claim" + whereClause + " GROUP BY unit"
      db.each(
        sql,
        allParams,
        function(err, row) {
          if (err) { rowErr = err } else { data[row.unit] = row.total }
        },
        function(allErr, num) {
          if (rowErr || allErr) {
            reject(rowErr || allErr)
          } else {
            resolve({ data: data })
          }
        }
      )
    })
  }

  offerUpdateAmounts(
    handleId, updateTime, addAmountGiven, addAmountGivenConfirmed,
    addNonAmountGivenConfirmed
  ) {
    return new Promise((resolve, reject) => {
      var stmt =
          "UPDATE offer_claim SET updatedAt = datetime(?)"
          + ", amountGiven = amountGiven + ?"
          + ", amountGivenConfirmed = amountGivenConfirmed + ?"
          + ", nonAmountGivenConfirmed = nonAmountGivenConfirmed + ?"
          + " WHERE handleId = ?"
      db.run(
        stmt,
        [updateTime, addAmountGiven, addAmountGivenConfirmed,
          addNonAmountGivenConfirmed, handleId],
        function(err) {
          if (err) { reject(err) } else { resolve(this.changes) }
        }
      )
    })
  }








  /****************************************************************
   * Org Role
   **/

  orgRoleInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = "INSERT INTO org_role_claim"
          + "(jwtId, issuerDid, orgName, roleName, startDate, endDate, memberDid)"
          + " VALUES (?, ?, ?, ?, date(?), date(?), ?)";
      db.run(
        stmt,
        [
          entry.jwtId, entry.issuerDid, entry.orgName, entry.roleName,
          entry.startDate, entry.endDate, entry.memberDid
        ],
        function(err) { if (err) { reject(err) } else { resolve(this.lastID) } })
    })
  }

  orgRoleClaimByOrgAndDates(orgName, roleName, startDate, endDate, memberDid) {
    return new Promise((resolve, reject) => {
      const startDateSql = startDate ? " AND startDate = date('" + startDate + "')" : ""
      const endDateSql = endDate ? " AND endDate = date('" + endDate + "')" : ""
      db.get(
        "SELECT rowid, * FROM org_role_claim WHERE orgName = ? AND roleName = ?" + startDateSql + endDateSql + " AND memberDid = ?",
        [orgName, roleName, memberDid],
        function(err, row) { if (err) { reject(err) } else { resolve(row) } })
    })
  }

  /**
     @param orgName
     @param roleName
     @param onDate date in ISO format
     @Returns all role claims at that time, along with the confirmations
  **/
  retrieveOrgRoleClaimsAndConfirmationsOnDate(orgName, roleName, onDateStr) {
    return new Promise((resolve, reject) => {
      var data = []
      let sql =
        "SELECT r.rowid AS rid, r.orgName, r.roleName, r.startDate, r.endDate,"
        + " r.memberDid, c.rowid AS cid, c.issuer AS confirmDid, c.orgRoleRowId"
        + " FROM org_role_claim r"
        + " LEFT JOIN confirmation c ON c.orgRoleRowId = r.rowid"
        + " WHERE r.orgName = ? AND r.roleName = ?"
        + " AND (r.startDate IS NULL OR r.startDate <= date(?)) AND (r.endDate IS NULL OR date(?) <= r.endDate)"
      db.each(
        sql,
        [orgName, roleName, onDateStr, onDateStr],
        function(err, row) {
          let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, orgRoleRowId:row.orgRoleRowId} : null
          let both = {
            orgRole: {
              id: row.rid, memberDid: row.memberDid, orgName: row.orgName, roleName: row.roleName,
              startDate: row.startDate, endDate: row.endDate
            },
            confirmation: confirmation,
          }
          data.push(both)
        },
        function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        })
    })
  }







  /****************************************************************
   * Plan
   **/

  planInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "INSERT OR IGNORE INTO plan_claim (jwtId, issuerDid, agentDid, handleId"
          + ", name, description, image, endTime, startTime,"
          + " resultDescription, resultIdentifier, url"
          + ") VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?), datetime(?), ?, ?, ?)"
      )
      db.run(stmt, [
        entry.jwtId, entry.issuerDid, entry.agentDid, entry.handleId,
        entry.name, entry.description, entry.image, entry.endTime, entry.startTime,
        entry.resultDescription, entry.resultIdentifier, entry.url,
      ], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  planInfoByHandleId(handleId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM plan_claim WHERE handleId = ?",
        [handleId],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row?.endTime) { row.endTime = isoAndZonify(row.endTime) }
            if (row?.startTime) { row.startTime = isoAndZonify(row.startTime) }
            resolve(row)
          }
        }
      )
    })
  }

  /**
     See tableEntriesByParamsPaged
     Returns Promise of { data: [], hitLimit: true|false }
  **/
  plansByParamsPaged(params, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'plan_claim',
      'rowid',
      ['rowid', 'jwtId', 'issuerDid', 'agentDid', 'handleId',
       'name', 'description', 'endTime', 'startTime',
       'resultDescription', 'resultIdentifier'],
      ['image', 'url'],
      'description',
      ['endTime', 'startTime'],
      params,
      afterIdInput,
      beforeIdInput
    )
  }

  /**
     See tableEntriesByParamsPaged, with search for issuerDid
     Returns Promise of { data: [], hitLimit: true|false }
  **/
  plansByIssuerPaged(issuerDid, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'plan_claim',
      'rowid',
      ['rowid', 'jwtId', 'issuerDid', 'agentDid', 'handleId',
       'name', 'description', 'endTime', 'startTime',
       'resultDescription', 'resultIdentifier'],
      ['image', 'url'],
      'description',
      ['endTime', 'startTime'],
      { issuerDid },
      afterIdInput,
      beforeIdInput
    )
  }

  planUpdate(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "UPDATE plan_claim set jwtId = ?, issuerDid = ?, agentDid = ?"
          + ", name = ?, description = ?, image = ?, endTime = datetime(?)"
          + ", startTime = datetime(?)"
          + ", resultDescription = ?, resultIdentifier = ?, url = ?"
          + " WHERE handleId = ?"
      )
      db.run(stmt, [
        entry.jwtId, entry.issuerDid, entry.agentDid,
        entry.name, entry.description, entry.image, entry.endTime, entry.startTime,
        entry.resultDescription, entry.resultIdentifier, entry.url, entry.handleId
      ], function(err) {
        if (!err && this.changes === 1) {
          resolve()
        } else {
          reject("Expected to update 1 plan row but updated " + this.changes + " with error: " + err)
        }
      })
    })
  }









  /****************************************************************
   * Project
   **/

  projectInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "INSERT OR IGNORE INTO project_claim (jwtId, issuerDid, agentDid, handleId"
          + ", name, description, image, endTime, startTime,"
          + " resultDescription, resultIdentifier, url"
          + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(?), datetime(?), ?, ?, ?)"
      )
      db.run(
        stmt,
        [
          entry.jwtId, entry.issuerDid, entry.agentDid, entry.handleId,
          entry.name, entry.description, entry.image, entry.endTime, entry.startTime,
          entry.resultDescription, entry.resultIdentifier, entry.url,
        ],
        function(err) {
          if (err) { reject(err) } else { resolve(this.lastID) }
        }
      )
    })
  }

  projectInfoByHandleId(handleId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM project_claim WHERE handleId = ?",
        [handleId],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            if (row?.endTime) { row.endTime = isoAndZonify(row.endTime) }
            if (row?.startTime) { row.startTime = isoAndZonify(row.startTime) }
            resolve(row)
          }
        }
      )
    })
  }

  /**
     See tableEntriesByParamsPaged
     Returns Promise of { data: [], hitLimit: true|false }
  **/
  projectsByParamsPaged(params, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'project_claim',
      'rowid',
      ['rowid', 'jwtId', 'issuerDid', 'agentDid', 'handleId',
       'name', 'description', 'endTime', 'startTime',
       'resultDescription', 'resultIdentifier'],
      ['image', 'url'],
      'description',
      ['endTime', 'startTime'],
      params,
      afterIdInput,
      beforeIdInput
    )
  }

  /**
     See tableEntriesByParamsPaged, with search for issuerDid
     Returns Promise of { data: [], hitLimit: true|false }
  **/
  projectsByIssuerPaged(issuerDid, afterIdInput, beforeIdInput) {
    return tableEntriesByParamsPaged(
      'project_claim',
      'rowid',
      ['rowid', 'jwtId', 'issuerDid', 'agentDid', 'handleId',
       'name', 'description', 'endTime', 'startTime',
       'resultDescription', 'resultIdentifier'],
      ['image', 'url'],
      'description',
      ['endTime', 'startTime'],
      { issuerDid },
      afterIdInput,
      beforeIdInput
    )
  }

  projectUpdate(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "UPDATE project_claim set jwtId = ?, issuerDid = ?, agentDid = ?"
          + ", name = ?, description = ?, image = ?, endTime = datetime(?)"
          + ", startTime = datetime(?)"
          + ", resultDescription = ?, resultIdentifier = ?, url = ?"
          + " WHERE handleId = ?"
      )
      db.run(stmt, [
        entry.jwtId, entry.issuerDid, entry.agentDid,
        entry.name, entry.description, entry.image, entry.endTime, entry.startTime,
        entry.resultDescription, entry.resultIdentifier, entry.url, entry.handleId
      ], function(err) {
        if (!err && this.changes === 1) {
          resolve()
        } else {
          reject("Expected to update 1 project row but updated " + this.changes + " with error: " + err)
        }
      })
    })
  }










  /****************************************************************
   * Registration
   **/

  registrationInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = (
        "INSERT OR IGNORE INTO registration"
        + " (did, agent, epoch, jwtId, maxRegs, maxClaims)"
        + " VALUES (?, ?, ?, ?, ?, ?)");
      db.run(
        stmt,
        [entry.did, entry.agent, entry.epoch, entry.jwtId, entry.maxRegs, entry.maxClaims],
        function(err) {
          if (err) { reject(err) } else { resolve(this.lastID) }
        })
    })
  }

  registrationByDid(did) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM registration WHERE did = ?", [did], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({
            id:row.rowid, did:row.did, agent:row.agent, epoch:row.epoch, jwtId:row.jwtId,
            maxRegs: row.maxRegs, maxClaims: row.maxClaims
          })
        } else {
          resolve(null)
        }
      })
    })
  }

  registrationCountByAfter(issuer, seconds) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT count(*) as numRegs FROM registration WHERE agent = ? AND ? < epoch",
        [issuer, seconds],
        function(err, row) {
          if (err) {
            reject(err)
          } else if (row) {
            resolve(row.numRegs)
          } else {
            // should never happen
            reject('Got no result from registration count query.')
          }
        })
    })
  }

  registrationUpdateMaxClaims(issuer, maxClaims) {
    return new Promise((resolve, reject) => {
      var stmt = ("UPDATE registration SET maxClaims = ? WHERE did = ?");
      db.run(stmt, [maxClaims, issuer], function(err) {
        if (err) {
          reject(err)
        } else {
          if (this.changes === 1) {
            resolve()
          } else {
            reject("Expected to update 1 registration row but updated " + this.changes)
          }
        }
      })
    })
  }

  registrationUpdateMaxRegs(issuer, maxRegs) {
    return new Promise((resolve, reject) => {
      var stmt = ("UPDATE registration SET maxRegs = ? WHERE did = ?");
      db.run(stmt, [maxRegs, issuer], function(err) {
        if (err) {
          reject(err)
        } else {
          if (this.changes === 1) {
            resolve()
          } else {
            reject("Expected to update 1 registration row but updated " + this.changes)
          }
        }
      })
    })
  }




  /****************************************************************
   * Tenure
   **/

  tenureClaimById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM tenure_claim WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, jwtId:row.jwtId, partyDid:row.partyDid, polygon:row.polygon})
        } else {
          resolve(null)
        }
      })
    })
  }

  /**
     @return all recent tenure claims
  **/
  tenureClaims() {
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT rowid, * FROM tenure_claim ORDER BY rowid DESC LIMIT 50"
      db.each(sql, [], function(err, row) {

        row.id = row.rowid
        delete row.rowid

        data.push(row)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  tenureByPoint(lat, lon) {
    return new Promise((resolve, reject) => {
      let data = []
      db.each("SELECT rowid, * FROM tenure_claim WHERE westlon <= ? AND ? <= eastlon AND minlat <= ? AND ? <= maxlat ORDER BY rowid DESC LIMIT 50", [lon, lon, lat, lat], function(err, row) {
        data.push(
          {
            id: row.rowid, jwtId: row.jwtId, claimContext: row.claimContext, claimType: row.claimType,
            issuerDid: row.issuerDid, partyDid: row.partyDid, polygon: row.polygon,
            westlon: row.westlon, minlat: row.minlat, eastlon: row.eastlon, maxlat: row.maxlat
          }
        )
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  tenureClaimByPartyAndGeoShape(partyDid, polygon) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT rowid, * FROM tenure_claim WHERE partyDid = ? AND polygon = ?",
        [partyDid, polygon],
        function(err, row) {
          if (err) {
            reject(err)
          } else {
            resolve(row)
          }
        })
    })
  }


  tenureInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO tenure_claim (jwtId, issuerDid, partyDid, polygon, westlon, minlat, eastlon, maxlat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      db.run(
        stmt,
        [
          entry.jwtId, entry.issuerDid, entry.partyDid, entry.polygon,
          entry.westLon, entry.minLat, entry.eastLon, entry.maxLat
        ],
        function(err) {
          if (err) {
            reject(err)
          } else {
            resolve(this.lastID)
          }
        })
    })
  }

  /**
     @returns all tenures claimed at that point, plus any confirmations of them
  **/
  retrieveTenureClaimsAndConfirmationsAtPoint(lat, lon) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT t.rowid as tid, t.partyDid as tenurePartyDid, t.polygon, c.rowid AS cid, c.issuer as confirmDid, c.tenureRowId from tenure_claim t LEFT JOIN confirmation c on c.tenureRowId = t.rowid WHERE westlon <= ? AND ? <= eastlon AND minlat <= ? AND ? <= maxlat",
        [lon, lon, lat, lat],
        function(err, row) {
          let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, tenureRowId:row.tenureRowId} : null
          let both = {tenure:{id:row.tid, partyDid:row.tenurePartyDid, polygon:row.polygon}, confirmation:confirmation}
          data.push(both)
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        })
    })
  }

  voteInsert(entry) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO vote_claim (jwtId, issuerDid, actionOption, candidate, eventName, eventStartTime) VALUES (?, ?, ?, ?, ?, datetime(?))");
      db.run(
        stmt,
        [
          entry.jwtId, entry.issuerDid, entry.actionOption, entry.candidate, entry.eventName, entry.eventStartTime
        ],
        function(err) {
          if (err) { reject(err) } else { resolve(this.lastID) }
        })
    })
  }

  retrieveVoteCounts() {
    return new Promise((resolve, reject) => {
      var data = []
      var stmt = ("select candidate, actionOption, count(*) as numVotes from vote_claim group by candidate, actionOption order by count(*) desc");
      db.each(
        stmt,
        function(err, row) {
          let result = {speaker: row.candidate, title: row.actionOption, count: row.numVotes}
          data.push(result)
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        })
    })
  }




  /****************************************************************
   * Network Visibility
   **/

  /**
    If the pair already exists, will resolve (instead of rejecting).
   **/
  networkInsert(subject, object, url) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT OR IGNORE INTO network VALUES (?, ?, ?)")
      db.run(stmt, [subject, object, url], function(err) {
        if (err) {
          // This SQLite check is no longer necessary due to "OR IGNORE". Nuke it when you've tested.
          if (err.errno === 19) {
            // If you print out this error, it looks like this:
            // { [Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: network.subject, network.object] errno: 19, code: 'SQLITE_CONSTRAINT' }
            // ... where two fields are 'errno' and 'code'.  What is the rest of the stuff in there?
            // Well, hopefully this check is correct.
            resolve()
          } else {
            reject(err)
          }
        } else {
          resolve()
        }
      })
    })
  }

  networkDelete(subject, object, url) {
    return new Promise((resolve, reject) => {
      var stmt = ("DELETE FROM network WHERE subject = ? AND object = ?")
      db.run(
        stmt,
        [subject, object],
        function(err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
    })
  }

  // return all objects that subject can explicitly see
  getSeenBy(subject) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT object FROM network WHERE subject = ? ORDER BY object",
        [subject],
        function(err, row) {
          data.push(row.object)
        }, function(err, num) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
    })
  }

  // return all {did, url} records that are seen by everyone
  getSeenByAll() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT object, url FROM network WHERE subject = ? ORDER BY object",
        [this.ALL_SUBJECT_MATCH()],
        function(err, row) {
          data.push({did: row.object, url: row.url})
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        })
    })
  }

  // return all subjects that can see object
  getWhoCanSee(object) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each(
        "SELECT subject FROM network WHERE object = ? ORDER BY subject",
        [object],
        function(err, row) {
          data.push(row.subject)
        }, function(err, num) {
          if (err) { reject(err) } else { resolve(data) }
        }
      )
    })
  }

}

export const dbService = new EndorserDatabase()
