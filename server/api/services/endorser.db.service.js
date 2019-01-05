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
      var stmt = ("INSERT INTO event VALUES (?, ?)");
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

  eventByNameTime(name, startTime) {
    return new Promise((resolve, reject) => {
      db.get("SELECT rowid, name, startTime FROM event WHERE name = ? AND startTime = ?", [name, startTime], function(err, row) {
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

  jwtAll() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, encoded FROM jwt", function(err, row) {
        data.push({id:row.rowid, encoded:row.encoded})
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data);
        }
      });
    })
  }

  jwtById(id) {
    return new Promise((resolve, reject) => {
      var data = null
      db.each("SELECT rowid, encoded FROM jwt WHERE rowid = " + id, function(err, row) {
        data = {id:row.rowid, encoded:row.encoded}
      }, function(err, num) {
        if (err) {
          reject(err)
        } else {
          resolve(data);
        }
      });
    })
  }

  async jwtInsert(encoded) {
    return new Promise((resolve, reject) => {
      var stmt = ("INSERT INTO jwt VALUES (?)");
      db.run(stmt, [encoded], function(err) {
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
