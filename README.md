# endorser-ch

A server for recording assertions and then reporting on them

This is simply an API for creating and querying claims.  For a full system, combine with https://github.com/trentlarson/uport-demo





## Get Started

Get started developing...

```shell
# install dependencies
npm ci

# set up the environment
cp .env.local .env

# setup/migrate DB
NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run migrate
# note that it fails if you don't run `npm ci`; `npm install` isn't enough (Ug!)

# run in development mode
NODE_ENV=dev npm run dev

# run tests
test/test.sh
```

## Install Dependencies

Install all package dependencies (one time operation)

```shell
npm ci
```

## Run It
#### Run in *development* mode:
Runs the application is development mode. Should not be used in production

```shell
npm run dev
```

or debug it

```shell
npm run dev:debug
```

#### Run in *production* mode:

Compiles the application and starts it in production production mode.

```shell
scripts/deploy.sh
# Then SSH to the box and:
npm run compile
#npm start
NODE_ENV=dev nohup npm run dev >> ../endorser.out 2>&1 &
```

## Test It

Run the Mocha unit tests

```shell
./test/test.sh
```

or debug them

```shell
npm run test:debug
```

Let's create some claims.  First, a claim of attendance.  Here's the object structure:

```
{
  "@context": "http://schema.org",
  "@type": "JoinAction",
  "agent": { "did": "did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e" },
  "event": {
    "organizer": { "name": "Bountiful Voluntaryist Community" },
    "name": "Saturday Morning Meeting",
    "startTime": "2018-12-29T08:00:00.000-07:00"
  }
}
```
... and base 64 encoded: `eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJKb2luQWN0aW9uIiwiYWdlbnQiOnsiZGlkIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0sImV2ZW50Ijp7Im9yZ2FuaXplciI6eyJuYW1lIjoiQm91bnRpZnVsIFZvbHVudGFyeWlzdCBDb21tdW5pdHkifSwibmFtZSI6IlNhdHVyZGF5IE1vcm5pbmcgTWVldGluZyIsInN0YXJ0VGltZSI6IjIwMTgtMTItMjlUMDg6MDA6MDAuMDAwLTA3OjAwIn19`

Now for a confirmation of that activity:

```
{
  "@context": "http://endorser.ch",
  "@type": "Confirmation",
  "claimEncoded": "eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJKb2luQWN0aW9uIiwiYWdlbnQiOnsiZGlkIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0sImV2ZW50Ijp7Im9yZ2FuaXplciI6eyJuYW1lIjoiQm91bnRpZnVsIFZvbHVudGFyeWlzdCBDb21tdW5pdHkifSwibmFtZSI6IlNhdHVyZGF5IE1vcm5pbmcgTWVldGluZyIsInN0YXJ0VGltZSI6IjIwMTgtMTItMjlUMDg6MDA6MDAuMDAwLTA3OjAwIn19"
}
```



```shell

# create an JoinAction JWT entry
curl http://localhost:3000/api/claim
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMyMDQsImV4cCI6MTU0NzQ0OTYwNCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.uwutl2jx7lHqLeDRbEv6mKxUSUY75X91g-V0fpJcKZ2dO9jUYnZ9VEkS7rpsD8lcdYoQ7f5H8_3LT_vhqE-9UgA"}'
curl http://localhost:3000/api/claim/1
curl 'http://localhost:3000/api/claim?claimContents=Bountiful'
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg0ODQxMTEsImV4cCI6MTU0ODU3MDUxMSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fX0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.5l1NTMNk0rxBm9jj91hFnT3P463aYELbmPVeQcFCkHZ2Gj9sP3FgbidCI69AeSArAVKvvRGAjcifJ94UtiEdfAA"}'
curl http://localhost:3000/api/claim?claimType=JoinAction
curl http://localhost:3000/api/action/1
curl http://localhost:3000/api/event/1
curl http://localhost:3000/api/event/1/actionClaimsAndConfirmations
curl 'http://localhost:3000/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00'
curl 'http://localhost:3000/api/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"a":4\}'
curl 'http://localhost:3000/api/action?eventStartTime=2018-12-29T08:00:00.000-07:00'
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTUyNTgyODMsImV4cCI6MTU1NTM0NDY4Mywic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IlRlbnVyZSIsInNwYXRpYWxVbml0Ijp7ImdlbyI6eyJAdHlwZSI6Ikdlb1NoYXBlIiwicG9seWdvbiI6IjQwLjg4Mzk0NCwtMTExLjg4NDc4NyA0MC44ODQwODgsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0NTE1IDQwLjg4Mzk0NCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ3ODcifX0sInBhcnR5Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.g7jKukK9a2NAf2AHrrtQLNWePmkU1iLya1EFUdRxvk18zNJBFdHF77YoZMhz5VAW4cIgaUhnzVqNgVrXLc7RSAE"}'
curl 'http://localhost:3000/api/tenure/1'
curl 'http://localhost:3000/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787'
curl 'http://localhost:3000/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787'

# clean out and recreate DB
rm ../endorser-ch-dev.sqlite3
NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run migrate
```


## Try It

See API docs: http://localhost:3000/api-docs

* Open you're browser to [http://localhost:3000](http://localhost:3000)
* Invoke the `/examples` endpoint 
  ```shell
  curl http://localhost:3000/api/examples
  ```



## Debug It

#### Debug the server:

```
npm run dev:debug
```

#### Debug Tests

```
npm run test:debug
```

#### Debug with VSCode

Add these [contents](https://github.com/cdimascio/generator-express-no-stress/blob/next/assets/.vscode/launch.json) to your `.vscode/launch.json` file
## Lint It

View airbnb linter output

```
npm run lint
```

Fix all airbnb linter errors

```
npm run lint
```

## Deploy It

Deploy to CloudFoundry

```shell
cf push endorser-ch
```

## Kudos

Project initialized with https://github.com/cdimascio/generator-express-no-stress

## Related Work

- [Sovrin](https://sovrin.org)
- [Accredible](https://www.accredible.com/) (... and their verification system)[https://verify.accredible.com] (uses Tierion)[https://help.accredible.com/hc/en-us/articles/115005058985-Manually-Verifying-Blockchain-Records]
- [Blockcerts for blockchain credentials](https://www.blockcerts.org)
- [Open Badges spec] (https://www.imsglobal.org/sites/default/files/Badges/OBv2p0Final/index.html)

## ToDo


next deploy:
- ci, migrate, and populate jwt.claim (inside endorser-ch)

$ npm ci
$ NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run migrate
$ NODE_ENV=dev node

var base64url = require('base64url')
var sqlite3 = require('sqlite3').verbose()
var dbInfo = require('./conf/flyway.js')
var db = new sqlite3.Database(dbInfo.fileLoc)
let selectSql = "SELECT rowid, claimEncoded FROM jwt"
let updateSql = "UPDATE jwt SET claim=? WHERE rowid=?"
db.each(selectSql, [], function(err, row) {
  db.run(updateSql, [base64url.decode(row.claimEncoded), row.rowid], function(err){ if (err) {console.log(err)}})
}, function(err, num) {
  if (err) {
    console.log(err)
  } else {
    console.log("Success")
  }
})




- 100 0 errors in local data on report screens
- 90 2 add search for claim #claim
- 90 0 wrap all async functions (eg. services) in try-catch blocks
- 90 2 add search for claim on parcel of land #cplot ^claim
- 90 2 add search for endorser (in network?)
- 90 0 is issuer used consistently from JWT (and is payload.iss usage accurate?)
- 90 0 remove DB-based network lookup: inNetwork call in jwt.service
- 90 0 rename issuer to issuerDid in confirmation table
- 90 0 retrieveTenureClaimsAndConfirmations & retrieveActionClaimsAndConfirmations should be OUTER JOIN?
- 90 0 remove issuerDid from *_claim tables and build into logic (since >1 issuer could claim each)
- 90 2 add search for claim
  - 90 2 add search for claim on parcel of land
  - ?
- 90 2 add search for endorser (in network?)
  - ?
- 90 1 check & verify the user credentials for every API request
  - 90 1 add the user info to requests
    - x 90 1 send & check the user DID
    - 90 2 send & check the JWT
  - x 90 1 add in-network data for each insert
  - 90 2 change each of the SQL searches to check in-network
- 90 5 write & support use-cases
- 70 2 add Typescript
- 80 5 switch/add format to verifiable credentials?
- 80 5 uport: inside JSON payload, show a name if DID matches a contact
- 80 0 fix API docs http://localhost:3000/api-explorer/ (linked from main page)
- 60 6 put all functionality in uport mobile app
- 70 0 bug: if there's already a response JWT & message then a new one might not show
- 70 0 retrieve dates in full ISO-format dates (eg for confirmations), not dates without timestamp
- 70 0 ensure JWT subject is counted as a confirmation
- 70 0 bug when a claim is duplicated
- 70 1 run tests while disconnected from the internet
- 85 0 fix error: user claims & confirmations not showing (currently by non-subject should be by issuer)
- 85 0 remove "subject" from terminology in code; prefer "agent"
- 90 0 add helmet
- 80 1 add SSL
- 90 1 run prod in prod mode (ie. not: npm run dev)
- 80 1 db
  - add action_claim.startDateCanonical
    - and fill it
  - add created date to each record
    - and fill it
  - remove jwt.claimEncoded
  - change JWT & CONFIRMATION subject to subjectDid; issuer to issuerDid & type to VARCHAR(100)
- 80 0 in SignClaim, set to confirmations & choose some, set to Join action, set to confirmations again and see that the list is not refreshed
- 60 3 neo4j?
- 70 0 usability: fade out the confirmation button when pushed
- 60 0 write migration to remove claimEncoded column
- on uport-demo: change store/play pics in Welcome.js to local files
- in confirmation, check whether it really is a JoinAction
- try-catch around jwt.service resolveAuthenticator when not connected to internet
- after signing a claim, signing another claim doesn't even hit the server until page refresh
- report page: who has confirmations for an activity, test various data combinations (eg. action confirmed by self)
- report page: who has the most activity for a time range
- explore page: add # of confirmations, & DIDs (after they click on the previous claim?)
- given a user who has a claim, find if anyone in my network endorses them for that
- 80 0 gotta report errors to user (eg. unrecognized context URL or claim type in createWithClaimRecord result)
- 80 0 gotta report errors to user (eg. "encoded" instead of "jwtEncoded", no event found, repeated action claim submitted)
- change the storage in JWT table to have original claim (eg for Confirmations)
- make record IDs into hashes not sequentially increasing numbers
- confirm Attended Action, but just show confirmation numbers (?)
- tests: see above; duplicate JWT data; ACACs by different times; no claim in JWT
- remove duplicate decode in JWT service
- limit JWT retrieval to a date
- reject duplicate claim submissions
- handle "access_denied" when person rejects claim on phone
- generalize for more than just meetings (JoinActions)

- How do I find the app address or ID? 0xa55...40b, from phone to IP: 0x669...e8a then 0x1b2...2e6

