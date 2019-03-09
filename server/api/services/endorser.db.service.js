var sqlite3 = require('sqlite3').verbose()
var dbInfo = require('../../../conf/flyway.js')
var db = new sqlite3.Database(dbInfo.fileLoc)

const GREATER_THAN_OR_EQUAL_TO = "_greaterThanOrEqualTo"

class EndorserDatabase {

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

  actionClaimById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM action_claim WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, agentDid:row.agentDid, jwtId:row.jwtRowId, eventId:row.eventRowId, eventOrgName:row.eventOrgName, eventName:row.eventName, eventStartTime:row.eventStartTime})
        } else {
          resolve(null)
        }
      });
    })
  }

  actionClaimIdByDidEventId(agentDid, eventId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid FROM action_claim WHERE agentDid = ? AND eventRowId = ?", [agentDid, eventId], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve(row.rowid)
        } else {
          resolve(null)
        }
      });
    })
  }

  /**
     @param object with a key-value for each column-value to filter
   **/
  actionClaimsByParams(params) {
    if (params.id) {
      params.rowid = params.id
      delete params.id
    }

    var whereClause = ""
    var paramArray = []
    for (var param in params) {
      if (whereClause.length > 0) {
        whereClause += " AND"
      }

      var col = param
      var operator = "="
      if (col.endsWith(GREATER_THAN_OR_EQUAL_TO)) {
        col = col.substring(0, col.length - GREATER_THAN_OR_EQUAL_TO.length)
        operator = ">="
      }

      if (params[param].match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/)) {
        // treat dates differently for SQLite
        whereClause += " " + col + " " + operator + " datetime('" + params[param] + "')"
      } else {
        whereClause += " " + col + " " + operator + " ?"
        paramArray.push(params[param])
      }
    }
    if (whereClause.length > 0) {
      whereClause = " WHERE" + whereClause
    }
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT rowid, * FROM action_claim" + whereClause + " ORDER BY rowid DESC LIMIT 50"
      db.each(sql, paramArray, function(err, row) {

        row.id = row.rowid
        delete row.rowid
        row.eventId = row.eventRowId
        delete row.eventRowId
        row.jwtId = row.jwtRowId
        delete row.jwtRowId

        data.push(row)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  /**
     @param eventId
     @returns all actions on the event outer-joined with confirmations of those actions
   **/
  getActionClaimsAndConfirmationsByEventId(eventId) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT a.rowid AS aid, a.agentDid AS actionAgentDid, a.eventRowId, a.eventOrgName, a.eventName, a.eventStartTime, c.rowid AS cid, c.issuer AS confirmDid, c.actionRowId FROM action_claim a LEFT JOIN confirmation c ON c.actionRowId = a.rowid WHERE a.eventRowId = ?", [eventId], function(err, row) {
        let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, actionRowId:row.actionRowId} : null
        let both = {action:{id:row.aid, agentDid:row.actionAgentDid, eventRowId:row.eventRowId}, confirmation:confirmation}
        data.push(both)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  /**
     @param dateTimeStr in ISO format
     @Returns all actions on the event outer-joined with confirmations of those actions
  **/
  getActionClaimsAndConfirmationsForEventsSince(dateTimeStr) {
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT a.rowid AS aid, a.agentDid AS actionAgentDid, a.eventRowId, a.eventOrgName, a.eventName, a.eventStartTime, c.rowid AS cid, c.issuer AS confirmDid, c.actionRowId FROM action_claim a LEFT JOIN confirmation c ON c.actionRowId = a.rowid WHERE a.eventStartTime >= datetime('" + dateTimeStr + "')"
      db.each(sql, [], function(err, row) {
        let confirmation = row.confirmDid ? {id:row.cid, issuer:row.confirmDid, actionId:row.actionRowId} : null
        let both = {action:{id:row.aid, agentDid:row.actionAgentDid, eventId:row.eventRowId, eventOrgName:row.eventOrgName, eventName:row.eventName, eventStartTime:row.eventStartTime}, confirmation:confirmation}
        data.push(both)
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  actionClaimInsert(agentDid, jwtId, event) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO action_claim VALUES (?, ?, ?, ?, ?, datetime('" + event.startTime + "'))");
      db.run(stmt, [jwtId, agentDid, event.id, event.orgName, event.name], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  confirmationByIssuerAndAction(issuerDid, actionRowId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid, * FROM confirmation WHERE issuer = ? AND actionRowId = ?", [issuerDid, actionRowId], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, jwtId:row.jwtRowId, issuer:row.issuer, actionId:row.actionRowId})
        } else {
          resolve(null)
        }
      });
    })
  }

  confirmationInsert(issuer, jwtRowId, actionRowId, origClaim) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO confirmation VALUES (?, ?, ?, ?)");
      db.run(stmt, [jwtRowId, issuer, actionRowId, origClaim], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  eventById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid, orgName, name, startTime FROM event WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, orgName:row.orgName, name:row.name, startTime:row.startTime})
        } else {
          resolve(null)
        }
      });
    })
  }

  /**
     @param object with a key-value for each column-value to filter
   **/
  eventsByParams(params) {
    if (params.id) {
      params.rowid = params.id
      delete params.id
    }

    var whereClause = ""
    var paramArray = []
    for (var col in params) {
      if (whereClause.length > 0) {
        whereClause += " AND"
      }
      if (params[col].match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/)) {
        // treat dates differently for SQLite
        whereClause += " " + col + " = datetime('" + params[col] + "')"
      } else {
        whereClause += " " + col + " = ?"
        paramArray.push(params[col])
      }
    }
    if (whereClause.length > 0) {
      whereClause = " WHERE" + whereClause
    }
    return new Promise((resolve, reject) => {
      var data = []
      let sql = "SELECT rowid, orgName, name, startTime FROM event" + whereClause + " ORDER BY startTime DESC LIMIT 50"
      db.each(sql, paramArray, function(err, row) {
        data.push({id:row.rowid, orgName:row.orgName, name:row.name, startTime:row.startTime})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  eventInsert(orgName, name, startTime) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO event VALUES (?, ?, datetime(?))");
      db.run(stmt, [orgName, name, startTime], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  buildJwtEntity(payload, claimEncoded, jwtEncoded) {
    let issuedAt = new Date(payload.iat * 1000).toISOString()
    let issuer = payload.iss
    let subject = payload.sub
    let claimContext = payload.claim['@context']
    let claimType = payload.claim['@type']
    return {
      issuedAt: issuedAt,
      issuer: issuer,
      subject: subject,
      claimContext: claimContext,
      claimType: claimType,
      claimEncoded: claimEncoded,
      jwtEncoded: jwtEncoded
    }
  }

  jwtById(id) {
    return new Promise((resolve, reject) => {
      var data = null
      db.each("SELECT rowid, issuedAt, issuer, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt WHERE rowid = ? ORDER BY issuedAt DESC LIMIT 50", [id], function(err, row) {
        data = {id:row.rowid, issuedAt:row.issuedAt, issuer:row.issuer, subject:row.subject, claimContext:row.claimContext, claimType:row.claimType, claimEncoded:row.claimEncoded, jwtEncoded:row.jwtEncoded}
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  /**
     @param object with a key-value for each column-value to filter, with a special key 'excludeConfirmations' if it should exclude any claimType of 'Confirmation'
   **/
  jwtByParams(params) {
    if (params.id) {
      params.rowid = params.id
      delete params.id
    }

    var whereClause = ""
    if (params.excludeConfirmations) {
      whereClause += " claimType != 'Confirmation'"
      delete params.excludeConfirmations
    }
    var paramArray = []
    for (var col in params) {
      if (whereClause.length > 0) {
        whereClause += " AND"
      }
      if (params[col].match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/)) {
        // treat dates differently for SQLite
        whereClause += " " + col + " = datetime('" + params[col] + "')"
      } else {
        whereClause += " " + col + " = ?"
        paramArray.push(params[col])
      }
    }
    if (whereClause.length > 0) {
      whereClause = " WHERE" + whereClause
    }
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, issuer, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt" + whereClause + " ORDER BY issuedAt DESC LIMIT 50", paramArray, function(err, row) {
        data.push({id:row.rowid, issuedAt:row.issuedAt, issuer:row.issuer, subject:row.subject, claimContext:row.claimContext, claimType:row.claimType, claimEncoded:row.claimEncoded, jwtEncoded:row.jwtEncoded})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      });
    })
  }

  async jwtInsert(entity) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO jwt VALUES (datetime('" + entity.issuedAt + "'), ?, ?, ?, ?, ?, ?)");
      db.run(stmt, [entity.issuer, entity.subject, entity.claimContext, entity.claimType, entity.claimEncoded, entity.jwtEncoded], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

}

export default new EndorserDatabase();
