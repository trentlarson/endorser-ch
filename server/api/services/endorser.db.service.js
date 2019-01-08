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
      db.get("SELECT rowid, did, eventRowId FROM attendance WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, did:row.did, eventRowId:row.eventRowId})
        } else {
          resolve(null)
        }
      });
    })
  }

  attendanceIdByDidEvent(did, eventId) {
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

  attendanceInsert(did, eventRowId) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO attendance VALUES (?, ?)");
      db.run(stmt, [did, eventRowId], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  endorsementInsert(did, attendanceRowId) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO endorsement VALUES (?, ?)");
      db.run(stmt, [did, attendanceRowId], function(err) {
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
      db.get("SELECT rowid, name, startTime FROM event WHERE rowid = ?", [id], function(err, row) {
        if (err) {
          reject(err)
        } else if (row) {
          resolve({id:row.rowid, name:row.name, startTime:row.startTime})
        } else {
          resolve(null)
        }
      });
    })
  }

  eventIdByNameTime(name, startTime) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid FROM event WHERE name = ? AND startTime = ?", [name, startTime], function(err, row) {
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

  eventInsert(name, startTime) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO event VALUES (?, ?)");
      db.run(stmt, [name, startTime], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this.lastID)
        }
      })
    })
  }

  jwtEntity(encoded, payload) {
    let payloadEncoded = encoded.split('.')[1]
    let claim = payload.claim
    let claimType = claim['@type']
    let issuedAt = new Date(payload.iat * 1000).toISOString()
    let subject = payload.sub
    return {
      issuedAt: issuedAt,
      subject: subject,
      claimType: claimType,
      encoded: encoded,
      payloadEncoded: payloadEncoded
    }
  }

  jwtAll() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, issuedAt, subject, claimType, encoded, payloadEncoded FROM jwt", function(err, row) {
        data.push({id:row.id, issuedAt:row.issuedAt, subject:row.subject, claimType:row.claimType, encoded:row.encoded, payloadEncoded:row.payloadEncoded})
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
      db.each("SELECT rowid, issuedAt, subject, claimType, encoded, payloadEncoded FROM jwt WHERE rowid = " + id, function(err, row) {
        data = {id:row.id, issuedAt:row.issuedAt, subject:row.subject, claimType:row.claimType, encoded:row.encoded, payloadEncoded:row.payloadEncoded}
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
      var stmt = ("INSERT INTO jwt VALUES (?, ?, ?, ?, ?)");
      db.run(stmt, [entity.issuedAt, entity.subject, entity.claimType, entity.encoded, entity.payloadEncoded], function(err) {
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
