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

Compiles the application and starts it in production mode.

If you move/remove the previous install, you'll need to copy the .env file to new endorser-ch dir.

```shell
scripts/deploy.sh release-X ~/.ssh/id_rsa
# Then SSH to the box and:
# kill process: /usr/bin/node /home/ubuntu/.../_babel-node server
# ... and may have to kill nodemon & pino-pretty processes separately
cd endorser-ch
#npm run compile # doesn't work; maybe do this inside the compile in deploy.sh?
#npm start
NODE_ENV=dev nohup npm run dev >> ../endorser-ch.out 2>&1 &
```

## Test It

Run the Mocha unit tests

```shell
./test/test.sh
```

or debug them

```shell
./test/test.sh :debug
```

You can also run the server in offline test mode by setting environment variable
`NODE_ENV=test-local` and then it will accept all JWTs and it won't do any real
JWT validity checking, including expiration. (This may be changed when I figure
out how to validate JWTs without being online.) This is accomplished by the
`process.env.NODE_ENV === 'test-local'` code currently only found in
server/api/services/jwt.service.js


## Try It

For the full experience, use [this customized uPort demo](https://github.com/trentlarson/uport-demo) to connect to it.

See API docs: http://localhost:3000/api-docs

* Open you're browser to [http://localhost:3000](http://localhost:3000)
* Invoke the `/examples` endpoint
  ```shell
  curl http://localhost:3000/api/examples
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

# These JWTs are old so they'll require running in "test-local" mode.
export UPORT_PUSH_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NjAyMTI0MTMsImV4cCI6MTU2MDI5ODgxMywiaXNzIjoiZGlkOmV0aHI6MHgwMGM5YzIzMjZjNzNmNzMzODBlODQwMmIwMWRlOWRlZmNmZjJiMDY0In0.mUydq67R-gzz7c6iQBd06uKu2OEO32vqFbMWTxK3k5VUcDwFQR9XEj28KflBMmohm72nlITd_0kK0zIYSGaDwgA
curl http://localhost:3000/api/claim -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMyMDQsImV4cCI6MTU0NzQ0OTYwNCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.uwutl2jx7lHqLeDRbEv6mKxUSUY75X91g-V0fpJcKZ2dO9jUYnZ9VEkS7rpsD8lcdYoQ7f5H8_3LT_vhqE-9UgA"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/claim/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/action/1 -H 'Uport-Push-Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTU4MDc0MTYsImV4cCI6MTU1NzEwMzQxNiwiYXVkIjoiZGlkOmV0aHI6MHg2MWU3YmFlNzM5NDZjZGY4ZWUyZWE3ZWE4ZmQzYWZjZGVlOTcxMjBhIiwidHlwZSI6Im5vdGlmaWNhdGlvbnMiLCJ2YWx1ZSI6ImFybjphd3M6c25zOnVzLXdlc3QtMjoxMTMxOTYyMTY1NTg6ZW5kcG9pbnQvR0NNL3VQb3J0L2I3ODJkNGEzLWYwYzMtM2I1OS1hMjk3LTY4ZTlmYmViYWQyOSIsImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.7GnYLHHO8gT3ApW-c3pa0FH1Yj15xDB_UJmzpiHNvqpmxMZo_CnHYxyg9R-I71CZqfiO_7X7IXhj-oCI9jzmWwE' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/claim?claimContents=Bountiful' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg0ODQxMTEsImV4cCI6MTU0ODU3MDUxMSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fX0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.5l1NTMNk0rxBm9jj91hFnT3P463aYELbmPVeQcFCkHZ2Gj9sP3FgbidCI69AeSArAVKvvRGAjcifJ94UtiEdfAA"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/claim?claimType=JoinAction' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/action/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/event/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/event/1/actionClaimsAndConfirmations -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"a":4\}'
curl 'http://localhost:3000/api/action?eventStartTime=2018-12-29T08:00:00.000-07:00' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTUyNTgyODMsImV4cCI6MTU1NTM0NDY4Mywic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IlRlbnVyZSIsInNwYXRpYWxVbml0Ijp7ImdlbyI6eyJAdHlwZSI6Ikdlb1NoYXBlIiwicG9seWdvbiI6IjQwLjg4Mzk0NCwtMTExLjg4NDc4NyA0MC44ODQwODgsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0NTE1IDQwLjg4Mzk0NCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ3ODcifX0sInBhcnR5Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.g7jKukK9a2NAf2AHrrtQLNWePmkU1iLya1EFUdRxvk18zNJBFdHF77YoZMhz5VAW4cIgaUhnzVqNgVrXLc7RSAE"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/tenure/1' -H 'Uport-Push-Token: $UPORT_PUSH_TOKEN'
curl 'http://localhost:3000/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787' -H 'Uport-Push-Token: $UPORT_PUSH_TOKEN' | json_pp
curl -X POST http://localhost:3000/api/claim/makeMeGloballyVisible -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"

# clean out and recreate DB
rm ../endorser-ch-dev.sqlite3
NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run migrate
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

- [Sovrin AKA Hyperledger Indy](https://sovrin.org)
  - [Verifiable Organizations Network](https://vonx.io) who showed [a mobile demo at IIW 28](https://iiw.vonx.io).
- [Accredible](https://www.accredible.com/) (... and their verification system)[https://verify.accredible.com] (uses Tierion)[https://help.accredible.com/hc/en-us/articles/115005058985-Manually-Verifying-Blockchain-Records]
- [Blockcerts for blockchain credentials](https://www.blockcerts.org)
- [Open Badges spec] (https://www.imsglobal.org/sites/default/files/Badges/OBv2p0Final/index.html)

## ToDo

"CORS problems" - endorser-ch is running?
"Unsupported DID method 'ethr'" - dependencies? see https://github.com/trentlarson/endorser-ch/commit/a836946c1b1897000dbe7e6d610df32aa32742ba
"Converting circular structure to JSON" - network connected?

User story:
- in endorser-ch
  - run test/test.sh (can quit after first set of tests)
  - run: NODE_ENV=test-local npm run dev
- in uport-demo
  - change to user 11 Annabelle's Friend in claimsTest.js

  - show search results for skills
    - search for "carpentry" and see all DIDs are hidden
    - run in endorser-ch: npm run set-3-visible
    - search for "carpentry" and see some DIDs are shown and some are transitive

  - show attendance results
    - on Best Attendance screen

  - show eligibility results
    - on search screen
      /api/report/actionClaimsAndConfirmationsSince?dateTime=2018-01-01T00:00:00Z
    - processed to see confirmations
      searchResults.map((obj) => {return {did: obj.did, numActions: obj.actions.length, numConfirms: R.sum(obj.actions.map((a)=>a.confirmations.length))}})

  - show voting results
    - see votes from following
      /api/report/orgRoleClaimsAndConfirmationsOnDate?orgName=Cottonwood Cryptography Club&roleName=President&onDate=2019-06-18
    - processed to see votes
      R.map(o=>{return {did:o.did, roles:R.map(role=>{return {votes:role.confirmations.length, roleName:role.orgRole.roleName}})(o.orgRoles)}})(searchResults)

  - show tenure results and links to find people
    - go to Residence Report
    - see duplicate tenure claims
    - change to user -1 Trent
    - in tenure claim, see reachable user
    - confirm something about Annabelle did:ethr:0xaaa29f09c29fb0666b8302b64871d7029032b479
    - change to user 11 Annabelle's Friend
    - in tenure claim, go to see how there's now a reachable path to find out the other owner




- 99 0 backup DB
- 98 0 why confirmation not showing in DB?
- 95 0 in uport-demo: test full user story
- 95 0 and fix subjects (eg. Jun 29 claims by me for others)
- 95 1 allow read of all data in claims/confirmations issued by requester
- 95 1 in text search: show claim contents instead of DB records
- 95 2 publish txid of merkle-tree of the transactions (then automate merkle-tree)
- 90 1 change name of app from "uport demo" (when logging in)
- 90 2 update vulnerabilities in endorser-ch (from a836946c1b1897000dbe7e6d610df32aa32742ba )
- 90 0 add .json(someErr) to all routers in the error path
- 90 0 add helmet
- 90 1 run with nginx forwarding on port 80
- 90 2 switch from Confirmation to AgreeAction
- 90 0 disallow duplicate tenure claims
- 90 0 why do some claims (eg. claimIIW2019aFor1) not have iss set?
- 90 0 see Sonia one hop away, send search for her to replicate
- 90 0 wrap all async functions (eg. services) in try-catch blocks
- 90 1 don't count any confirmations by original claimiant in UI reporting
- 90 0 network: remove inserts and add explicit allowance for requester
- 90 0 is issuer used consistently from JWT (and is payload.iss usage accurate?)
- 90 0 rename issuer to issuerDid in confirmation table
- 90 0 retrieveTenureClaimsAndConfirmations & retrieveActionClaimsAndConfirmations should be OUTER JOIN?
- 90 0 remove issuerDid from *_claim tables and build into logic (since >1 issuer could claim each)
- 90 2 add search for claim
  - 90 2 add search for claim on parcel of land
  - ?
- 90 1 fix deploy issues: npm ci & prune (in deploy.sh) and babel (above)
- 90 1 run prod in prod mode (ie. not: npm run dev)
- 85 0 fix error: user claims & confirmations not showing (currently by non-subject should be by issuer)
- 85 0 remove "subject" from terminology in code; prefer "agent"
- 85 1 convert all response dates to ISO format (including zone)
- 85 1 look into the action & tenure & role results from "ClaimsAndConfirmations" and make sure the top-level list organization makes sense
- 85 0 deploy from git rather than from local?  (It's all public.)
- 80 0 automate DB backup
- 80 1 debug: add "id INTEGER PRIMARY KEY," to event table and see failures with unhandled promises
- 80 1 don't insert same subject-object into network DB
- 80 1 report page: who has confirmations for an activity, test various data combinations (eg. action confirmed by self)
- 80 2 export to Neo4J
- 80 5 switch/add format to verifiable credentials?
- 80 5 uport: inside JSON payload, show a name if DID matches a contact
- 80 0 fix swagger API docs http://localhost:3000/api-explorer/ (linked from main page)
- 80 1 add SSL
- 80 1 db
  - add action_claim.startDateCanonical
    - and fill it
  - add created date to each record
    - and fill it
  - remove jwt.claimEncoded
  - change JWT & CONFIRMATION subject to subjectDid; issuer to issuerDid & type to VARCHAR(100)
- 80 0 gotta report errors to user (eg. unrecognized context URL or claim type in createWithClaimRecord result)
- 80 0 gotta report errors to user (eg. "encoded" instead of "jwtEncoded", no event found, repeated action claim submitted)
- 80 0 gotta report errors to user (eg. repeated or failed confirmations so should see mix of successes and errors)
- 80 0 in SignClaim, set to confirmations & choose some, set to Join action, set to confirmations again and see that the list is not refreshed
- 80 0 usability: add a "waiting" spinner when remote method is called
- 70 0 bug: if there's already a response JWT & message then a new one might not show
- 70 0 retrieve dates in full ISO-format dates (eg for confirmations), not dates without timestamp
- 70 0 bug when a claim is duplicated
- 70 0 remove duplicate decode in JWT service
- 70 0 add test for rejection of duplicate claim submissions
- 70 0 handle "access_denied" when person rejects claim on phone
- 70 0 usability: fade out the confirmation button when pushed
- 70 3 have someone audit use of uport.pushToken
- 70 1 tests: see above; duplicate JWT data; ACACs by different times; no claim in JWT
- 70 2 add Typescript
- 70 1 DID validation check adds seconds to the tests (see timeout(4001)) so find a faster validation
- 60 0 make record IDs into hashes not sequentially increasing numbers
- 60 0 write migration to remove claimEncoded column
- 60 3 neo4j?
- 50 1 fix & enable the "should hide DIDs" tests in controller.js
- 50 0 optimize whoDoesRequestorSeeWhoCanSeeObject rather than 2 awaits
- 40 0 after signing a claim, signing another claim doesn't even hit the server until page refresh
- 40 6 put all functionality in uport mobile app
- 30 0 on uport-demo: change store/play pics in Welcome.js to local files
- 30 0 in confirmation, check whether it really is a JoinAction
- 30 0 try-catch around jwt.service resolveAuthenticator when not connected to internet
- 30 0 report page: who has the most activity for a time range

- How do I find the app address or ID? 0xa55...40b, from phone to IP: 0x669...e8a then 0x1b2...2e6

References

- uport-connect classes https://github.com/uport-project/uport-connect/blob/develop/docs/reference/index.md#Connect+requestDisclosure
