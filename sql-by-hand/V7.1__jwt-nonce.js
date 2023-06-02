/**
 This script will add a nonce to all records without one.

 In sqlite3, run this: UPDATE jwt SET hashNonce = null, hashHex = null, hashChainHex = null;

 ... then exit and run this:

 cp sql-by-hand/V7.1__jwt-nonce.js .
 NODE_ENV=... node V7.1__jwt-nonce.js

 */

const crypto = require("crypto");
const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)

var errResult = []
db.each(
  "SELECT id FROM jwt WHERE hashNonce IS null",
  function(err, row) {

    if (err) {
      console.log('Error in select:', err)
    } else if (row == null) {
      console.log('Error in select: null',)
    } else {
      var stmt = 'UPDATE jwt SET hashNonce = ? where id = ?'
      var nonce = crypto.randomBytes(18).toString('base64')
      db.run(
        stmt,
        [nonce, row.id],
        function (err2) {
          if (err) {
            console.log('Update to ' + row.id + ' error:', err)
            errResult.push('Error on jwt ' + row.id + ':' + err)
          } else if (this.changes === 1) {
            // no output needed
          } else {
            console.log('Update to ' + row.id + ' expected 1 row but updated ' + this.changes + ' rows.')
            errResult.push('Error on jwt ' + row.id + ': expected 1 row but updated ' + this.changes + ' rows.')
          }
        }
      )
    }
  },
  function(err, num) {
    console.log('Finished with ' + num + ' results. Error:', err, 'Accumulated errors:', errResult)
  }
)
