var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('../endorser-ch.sqlite3');

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

  attendanceById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid, did, eventRowId, claimEncoded FROM attendance WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, did:row.did, eventRowId:row.eventRowId, claimEncoded:row.claimEncoded})
        } else {
          resolve(null)
        }
      });
    })
  }

  attendanceIdByDidEventId(did, eventId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid FROM attendance WHERE did = ? AND eventRowId = ?", [did, eventId], function(err, row) {
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

  attendanceInsert(did, eventRowId, claimEncoded) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO attendance VALUES (?, ?, ?)");
      db.run(stmt, [did, eventRowId, claimEncoded], function(err) {
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

  confirmationInsert(did, attendanceRowId, claimEncoded) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO confirmation VALUES (?, ?, ?)");
      db.run(stmt, [did, attendanceRowId, claimEncoded], function(err) {
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

  eventIdByOrgNameNameTime(orgName, name, startTime) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid FROM event WHERE orgName = ? AND name = ? AND startTime = ?", [orgName, name, startTime], function(err, row) {
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

  jwtLatest() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt ORDER BY issuedAt DESC LIMIT 50", function(err, row) {
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

  jwtById(id) {
    return new Promise((resolve, reject) => {
      var data = null
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt WHERE rowid = ?", [id], function(err, row) {
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

  jwtByClaimType(claimType) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt WHERE claimType = ?", [claimType], function(err, row) {
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

  jwtBySubjectClaimType(subject, claimType) {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, subject, claimContext, claimType, claimEncoded, jwtEncoded FROM jwt WHERE subject = ? AND claimType = ?", [subject, claimType], function(err, row) {
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
