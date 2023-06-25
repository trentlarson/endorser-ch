/**
 This script will add a nonce to all records without one.

 In sqlite3, run this: UPDATE jwt SET claimCanonHashBase64 = null, hashChainB64 = null;

 ... then exit and run this:

 cp sql-by-hand/V7.1__jwt-nonce.js .
 NODE_ENV=... APP_DB_FILE=... node V7.1__jwt-nonce.js

 ... then POST to the endpoint /api/util/updateHashChain

 */

const canonicalize = require('canonicalize')
const crypto = require("crypto");
const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)

var errResult = []
db.each(
  "SELECT id, claim FROM jwt",
  function(err, row) {

    if (err) {
      console.log('Error in select:', err)
    } else if (row == null) {
      console.log('Error in select: null',)
    } else {
      var stmt = 'UPDATE jwt SET claimCanonHashBase64 = ?, hashNonce = ? where id = ?'
      var claimStr = canonicalize(JSON.parse(row.claim))
      var claimHash = crypto.createHash('sha256').update(claimStr).digest('base64')
      var nonce = crypto.randomBytes(18).toString('base64')
      db.run(
        stmt,
        [claimHash, nonce, row.id],
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
