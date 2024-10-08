/**
 This script will update the hashNonce, noncedHash, noncedHashAllChain, and noncedHashIssuerChain fields in the jwt table.

 Run thus, from the endorser-ch directory:

 cp sql-by-hand/V12.1__jwt_new_nonce_chains.js .
 APP_DB_FILE=... node V12.1__jwt_new_nonce_chains.js

 */

const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)
const util = require('./server/api/services/util')
const { dbService } = require('./server/api/services/endorser.db.service')
const crypto = require("crypto");

(async () => {
  try {

    const rows = await new Promise((resolve, reject) => {
      db.all("SELECT id, claim, hashNonce, issuer, issuedAt FROM jwt ORDER BY id", (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    });
    const rowsCount = rows.length;

    let errResult = [];
    let prevNoncedHashAllChain = "";
    for (const row of rows) {
      const hashNonce = crypto.randomBytes(18).toString('base64url');
      const nonceAndClaimStr = {
        "nonce": hashNonce,
        "claimStr": row.claim,
        "issuedAt": new Date(row.issuedAt).getTime() / 1000,
        "issuerDid": row.issuer,
      };
      const claimCanonHash = crypto.createHash('sha256').update(row.claim).digest('base64url')
      const noncedHash = util.hashedClaimWithHashedDids(nonceAndClaimStr);
      const noncedHashAllChain = util.hashPreviousAndNext(prevNoncedHashAllChain, noncedHash);
      const prevNoncedHashIssuerChain = (await dbService.jwtLastMerkleHashForIssuerBefore(row.issuer, row.id))?.noncedHashIssuerChain || "";
      const noncedHashIssuerChain = util.hashPreviousAndNext(prevNoncedHashIssuerChain, noncedHash);
      // if (row.id==='01J76DAFHY7T2PN9JAWGNN6TP2') {
      //   console.log('noncedHash:', noncedHash);
      //   console.log('prevNoncedHashIssuerChain:', prevNoncedHashIssuerChain);
      //   console.log('noncedHashIssuerChain:', noncedHashIssuerChain);
      // }

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE jwt SET claimCanonHash = ?, hashNonce = ?, noncedHash = ?, noncedHashAllChain = ?, noncedHashIssuerChain = ? WHERE id = ?',
          [claimCanonHash, hashNonce, noncedHash, noncedHashAllChain, noncedHashIssuerChain, row.id],
          function (err2) {
            if (err2) {
              errResult.push(err2);
              reject(err2);
            } else if (this.changes === 1) {
              //console.log('Successfully updated', row.id);
            } else {
              console.error('Unexpected results updating jwt ' + row.id + ': expected 1 row but updated ' + this.changes + ' rows.');
              errResult.push('Unexpected results updating jwt ' + row.id + ': expected 1 row but updated ' + this.changes + ' rows.');
            }
            resolve();
          }
        );
      });

      prevNoncedHashAllChain = noncedHashAllChain;
    }

    console.log('Finished with ' + rowsCount + ' rows. Accumulated errors:', errResult);

  } catch (err) {
    console.error('Error processing rows:', err);
  }

})()
