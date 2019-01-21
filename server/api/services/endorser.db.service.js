var sqlite3 = require('sqlite3').verbose()
var dbInfo = require('../../../conf/flyway.js')
var db = new sqlite3.Database(dbInfo.fileLoc)

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

  actionById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM action WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, did:row.did, eventRowId:row.eventRowId, eventOrgName:row.eventOrgName, eventName:row.eventName, eventStartTime:row.eventStartTime, claimEncoded:row.claimEncoded})
        } else {
          resolve(null)
        }
      });
    })
  }

  actionIdByDidEventId(did, eventId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid FROM action WHERE did = ? AND eventRowId = ?", [did, eventId], function(err, row) {
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
     @param eventId
     @returns an all actions on the event outer joined with confirmations of those actions
   **/
  getActionClaimsAndConfirmationsByEventId(eventId) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT a.rowId AS aid, a.did AS actionDid, a.claimEncoded, c.rowid AS cid, c.did AS confirmDid, c.actionRowId FROM action a LEFT JOIN confirmation c ON c.actionRowId = a.rowId WHERE a.eventRowId = ?", [eventId], function(err, row) {
        let confirmation = row.confirmDid ? {id:row.cid, did:row.confirmDid, actionRowId:row.actionRowId} : null
        let both = {action:{id:row.aid, did:row.actionDid}, confirmation:confirmation}
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

  actionInsert(did, event, claimEncoded) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO action VALUES (?, ?, ?, ?, ?, ?)");
      db.run(stmt, [did, event.id, event.orgName, event.name, event.startTime, claimEncoded], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  confirmationByDid(did) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM confirmation WHERE did = ?", [did], function(err, row) {
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

  confirmationInsert(did, actionRowId, claimEncoded) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO confirmation VALUES (?, ?, ?)");
      db.run(stmt, [did, actionRowId, claimEncoded], function(err) {
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
      whereClause += " " + col + " = ?"
      paramArray.push(params[col])
    }
    if (whereClause.length > 0) {
      whereClause = " WHERE" + whereClause
    }
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, orgName, name, startTime FROM event" + whereClause + " ORDER BY startTime DESC LIMIT 50", paramArray, function(err, row) {
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
      var stmt = ("INSERT INTO event VALUES (?, ?, ?)");
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
    let subject = payload.sub
    let claimContext = payload.claim['@context']
    let claimType = payload.claim['@type']
    return {
      issuedAt: issuedAt,
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
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt WHERE rowid = ? ORDER BY issuedAt DESC LIMIT 50", [id], function(err, row) {
        data = {id:row.rowid, issuedAt:row.issuedAt, subject:row.subject, claimContext:row.claimContext, claimType:row.claimType, claimEncoded:row.claimEncoded, jwtEncoded:row.jwtEncoded}
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
      whereClause += " " + col + " = ?"
      paramArray.push(params[col])
    }
    if (whereClause.length > 0) {
      whereClause = " WHERE" + whereClause
    }
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt" + whereClause + " ORDER BY issuedAt DESC LIMIT 50", paramArray, function(err, row) {
        data.push({id:row.rowid, issuedAt:row.issuedAt, subject:row.subject, claimContext:row.claimContext, claimType:row.claimType, claimEncoded:row.claimEncoded, jwtEncoded:row.jwtEncoded})
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
      var stmt = ("INSERT INTO jwt VALUES (?, ?, ?, ?, ?, ?)");
      db.run(stmt, [entity.issuedAt, entity.subject, entity.claimContext, entity.claimType, entity.claimEncoded, entity.jwtEncoded], function(err) {
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
