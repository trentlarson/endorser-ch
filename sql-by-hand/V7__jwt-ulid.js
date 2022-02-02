/**

Run from the endorser-ch directory after installing ulidx.

First, backup the DB.

Run `sqlite3 ../endorser-ch-...sqlite3` and:

```
ALTER TABLE jwt ADD COLUMN id TEXT;
UPDATE jwt SET hashHex = null;
-- funny that the flyway migrations fail on any column rename command
ALTER TABLE action_claim   RENAME jwtRowId TO jwtId;
ALTER TABLE confirmation   RENAME jwtRowId TO jwtId;
ALTER TABLE org_role_claim RENAME jwtRowId TO jwtId;
ALTER TABLE tenure_claim   RENAME jwtRowId TO jwtId;
ALTER TABLE vote_claim     RENAME jwtRowId TO jwtId;
```

... then exit and `cp sql-by-hand/V7__jwt-ulid.js .` and:

NODE_ENV=... node V7__jwt-ulid.js

... then repeat the sqlite3 command and:

```
CREATE TABLE jwt2 (id TEXT PRIMARY KEY, issuedAt DATETIME, issuer CHARACTER(60), subject VARCHAR(100), claim TEXT, claimContext VARCHAR(30), claimType VARCHAR(30), claimEncoded TEXT, jwtEncoded TEXT, hashHex VARCHAR(64), hashChainHex VARCHAR(64));

INSERT INTO jwt2 SELECT id, issuedAt, issuer, subject, claim, claimContext, claimType, claimEncoded, jwtEncoded, hashHex, hashChainHex FROM jwt;

DROP TABLE jwt;

ALTER TABLE jwt2 RENAME TO jwt;

UPDATE action_claim   SET jwtId = (SELECT id FROM jwt j where j.rowid = jwtId);
UPDATE confirmation   SET jwtId = (SELECT id FROM jwt j where j.rowid = jwtId);
UPDATE org_role_claim SET jwtId = (SELECT id FROM jwt j where j.rowid = jwtId);
UPDATE tenure_claim   SET jwtId = (SELECT id FROM jwt j where j.rowid = jwtId);
UPDATE vote_claim     SET jwtId = (SELECT id FROM jwt j where j.rowid = jwtId);

DELETE FROM schema_version;
```

... then exit and:

```
NODE_ENV=... FLYWAY_BASELINE_VERSION=1 DBUSER=sa DBPASS=... npm run flyway baseline
```

**/


const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')
const db = new sqlite3.Database(dbInfo.fileLoc)
const ulidx = require('ulidx')
const util = require('./server/api/services/util')

var allResult = []
db.each("SELECT rowid, * FROM jwt", function(err, row) {

  if (err) {
    console.log('Error in select:', err)
  } else if (row == null) {
    console.log('Error in select: null', )
  } else {
    var time = Date.parse(row.issuedAt)
    var id = ulidx.ulid(time)
    var hashHex = util.hashedClaimWithHashedDids({id:id, claim:row.claim})
    var stmt = 'UPDATE jwt SET id = ?, hashHex = ? where rowid = ?'
    db.run(stmt, [id, hashHex, row.rowid], function(err2) {
      if (err) {
        console.log('Update to " + row.rowid + " error:', err)
      } else if (this.changes === 1) {
        allResult.push(row.rowid)
      } else {
        console.log('Update to ' + row.rowid + ' expected 1 row but updated ' + this.changes + ' rows.')
      }
    })
  }
}, function(err, num) {
  console.log('Finished with ' + num + ' results. Errors:', allResult)
})

