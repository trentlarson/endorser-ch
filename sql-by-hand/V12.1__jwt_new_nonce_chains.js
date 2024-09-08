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
    let prevNonceHashAllChain = "";
    for (const row of rows) {
      const hashNonce = crypto.randomBytes(18).toString('base64url');
      const nonceAndClaimStr = {
        "nonce": hashNonce,
        "claimStr": row.claim,
        "issuedAt": new Date(row.issuedAt).getTime() / 1000,
        "issuerDid": row.issuer,
      };
      const claimCanonHash = crypto.createHash('sha256').update(row.claim).digest('base64url')
      const nonceHash = util.hashedClaimWithHashedDids(nonceAndClaimStr);
      const nonceHashAllChain = util.hashPreviousAndNext(prevNonceHashAllChain, nonceHash);
      const prevNonceHashIssuerChain = (await dbService.jwtLastMerkleHashForIssuerBefore(row.issuer, row.id))?.nonceHashIssuerChain || "";
      const nonceHashIssuerChain = util.hashPreviousAndNext(prevNonceHashIssuerChain, nonceHash);
      // if (row.id==='01J76DAFHY7T2PN9JAWGNN6TP2') {
      //   console.log('nonceHash:', nonceHash);
      //   console.log('prevNonceHashIssuerChain:', prevNonceHashIssuerChain);
      //   console.log('nonceHashIssuerChain:', nonceHashIssuerChain);
      // }

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE jwt SET claimCanonHash = ?, hashNonce = ?, nonceHash = ?, nonceHashAllChain = ?, nonceHashIssuerChain = ? WHERE id = ?',
          [claimCanonHash, hashNonce, nonceHash, nonceHashAllChain, nonceHashIssuerChain, row.id],
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

      prevNonceHashAllChain = nonceHashAllChain;
    }

    console.log('Finished with ' + rowsCount + ' rows. Accumulated errors:', errResult);

  } catch (err) {
    console.error('Error processing rows:', err);
  }

})()
