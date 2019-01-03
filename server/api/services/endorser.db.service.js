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

  jwtAll() {
    return new Promise((resolve, reject) => {
      var data = []
      db.each("SELECT rowid, encoded FROM jwt", function(err, row) {
        data.push({id:row.rowid, encoded:row.encoded})
      }, function(err, num) {
        resolve(data);
      });
    })
  }

  jwtById(id) {
    return new Promise((resolve, reject) => {
      var data = null
      db.each("SELECT rowid, encoded FROM jwt where rowid = " + id, function(err, row) {
        data = {id:row.rowid, encoded:row.encoded}
      }, function(err, num) {
        resolve(data);
      });
    })
  }

  jwtInsert(encoded) {
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
