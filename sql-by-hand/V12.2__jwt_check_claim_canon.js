/**
 This script will check for any entries where the 'claim' field is not canonicalized.
 It was used on 2024-09-07 and found that all entries on the prod DB were canonicalized.

 Run thus:

 cp sql-by-hand/V12.2__jwt_check_claim_canon.js .
 APP_DB_FILE=... node V12.2__jwt_check_claim_canon.js

 */

const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)
const canonicalize = require("canonicalize");

db.each(
  "SELECT id, claim FROM jwt order by id",
  function(err, row) {
    if (row.claim !== canonicalize(JSON.parse(row.claim))) {
      console.error('id', row.id)
      console.error('claim', row.claim)
      console.error('canon', canonicalize(JSON.parse(row.claim)))
    } else {
      if (row.id === '01J76DAFHY7T2PN9JAWGNN6TP2') {
        // just want to test that it's really looping
        console.log('Finished that specific one.')
      }
    }
  },
  function (err, count) {
    console.log('Checked', count, 'records.')
  }
)
