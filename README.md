# endorser-ch

This is an API for creating and querying claims in privacy-preserving ways.

* Note that more and more documentation is being written in [README-context.md](./README-context.md) and .cursor/rules MDC files for the purpose of sharing with AI.

In particular, this service:

* Stores and retrieves textual data as public but ensures identifier visibility is fully controlled by each user.

* Allows this without cost, at least for users in selected communities. (It does have some rate-limiting to manage user.)

* Supports certain use cases like counting confirmations or totals of certain claims. (This could be a separate service.)

This incarnation does have access to the identifier registration and visibility networks, providing some ability to
discover other users; the downside is that the server has special permission to see all this information. This could be optional as well, allowing for discovery via users' preferred messaging networks, except that the host of this service should have the ability to restrict or manage network abuses.

This only allows claims (AKA attestations) and confirmations that are cryptographically signed, in JWTs.

To try in a full system, see TimeSafari.app or use the mobile app linked at
[the public EndorserSearch.com server](https://endorsersearch.com);
there's [a test server](https://api-test.endorser.ch).

For the roadmap, see [project.task.yml](./project.task.yml).









## Get Started

Requires node v14+

* You can use [asdf](https://asdf-vm.com) with this project.
* ... or [pkgx](https://pkgx.dev):

```
sh <(curl https://pkgx.sh) +npm sh
````

#### Dependencies

```shell
# install dependencies
npm ci

# set up the environment (optional)
cp .env.local .env

# setup/migrate DB
NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run flyway migrate
# note that it fails if you don't run `npm ci`; `npm install` isn't enough (Ug!)

# run in development mode
NODE_ENV=dev npm run dev

# register ths first permissioned user by adding a DID thus:
echo "INSERT INTO registration (did, maxClaims, maxRegs, epoch) VALUES ('YOUR_DID', 100, 10000, 1719348718092);" | sqlite3 ../endorser-ch-dev.sqlite3
# ... but as an alternative for test DB & user setup: run a local test with instructions below to generate sample data, then: `cp ../endorser-ch-test-local.sqlite3 ../endorser-ch-dev.sqlite3` and rerun `npm run dev` and you'll have user #0 and others from the CREDS in [this file](./test/util.js)
```
If you just want to get running with initial test user, run `test/test.sh` (or do the "bare" setup below).

#### Other Ways To Run

Debug: `NODE_ENV=dev npm run dev:debug`

Deploy / Release:

* Update CHANGELOG.md & package.json, run `npm install`,  commit, and tag the release (`git tag release-XYZ && git push origin release-XYZ`).

Run on Docker:

* Set ENDORSER_VERSION to that tag and run the following:

```
export ENDORSER_VERSION=release-1.1.35

git checkout $ENDORSER_VERSION

docker build -t endorser-ch:$ENDORSER_VERSION --build-arg ENDORSER_VERSION .

docker run -d -p 3001:3000 -v /Users/trent/dev/home/endorser-ch-db:/mnt/database --name endorser-ch --env-file $PATH/.env -e APP_DB_FILE=/mnt/database/endorser-ch-dev.sqlite3 -e NODE_ENV=dev endorser-ch:$ENDORSER_VERSION
```

* Before deploying, ask yourself: do you need to run a migration?

* See .env.local for other environment variables, eg NOSTR_PRIVATE_KEY_NSEC

* After deploying, increment the version & add "-beta" to the package.json and `npm install` and commit.


When running on another domain (other than endorser.ch):

* Edit the .env SERVICE_ID with the value people should supply in the object field of RegisterAction.
  (It won't break anything to keep the value, but resulting credentials could cause confusion when looking across systems.)

* Edit the GLOBAL_ID_IRI_PREFIX in the util.js to have the global prefix for your domain in identifiers.
  (Same note: doesn't break anything but is potentially confusing.)

* ... and maybe the GLOBAL_ENTITY_ID_IRI_PREFIX if you want a different path after the domain. (These don't have to resolve, but it's a nice touch if they do.)




## Test It

#### Automated tests

Run the local automated tests and build sample data with this: `./test/test.sh`

* Note that this sometimes fails without reason and a rerun works, especially on "Load Claims Incrementally".

* That creates a sample DB file ../endorser-ch-test-local.sqlite3 which you may then use as baseline data for running in dev mode by copying to ../endorser-ch-dev.sqlite3

#### Bare DB

To create a bare DB with only a sample initial user #0 and no other test data:

```
rm ../endorser-ch-test-local.sqlite3
npm run flyway migrate
NODE_ENV=test-local npm run test test/controller0
```

#### Manual tests

`NODE_ENV=dev npm run dev` and then check that this works: http://localhost:3000/api-explorer/


#### Test server

You can use the test server APIs at [https://test-api.endorser.ch](https://test-api.endorser.ch)












## APIs

We have [Swagger docs on production](https://api.endorser.ch).

... but note that these are created by hand and may not be up to date with the latest code.
(I hope to automatically generate these from the code in the future so that both planned & existing APIs are available.)


#### V2 endpoints

More recent endpoints, especially the ones under the "api/v2" path, return an object with "data" (for GETs)
or "success" (for POSTs), or alternatively "error" when there is a problem.

#### V2 GET results

The reports with "v2" in the URL include paging that will retrieve more than just the most recent matches (currently 50).
These endpoints return an object with a "data" property that contains all the results,
and then a "hitLimit" property that tells whether there may be more results:

```
{
  "data": [...],
  "hitLimit": true
}
```

Without extra parameters, these will return the most recent batch. To get results further back, add a "beforeId" parameter.

For example, the default "api/v2/report/claims" will return data with the oldest having an ID of "01GQBE7Q0RQQAGJMEEW6RSGKTF", so if you call it with that as the "beforeId" then you'll get the next batch that goes further in the past (excluding that one):

```
curl -X GET "https://api.endorser.ch/api/v2/report/claims?beforeId=01GQBE7Q0RQQAGJMEEW6RSGKTF" -H  "accept: application/json"
```


#### V2 POST results

These endpoints return a "success" property, possibly with some data.


#### Claim IDs

Each claim is assigned a unique ID by this system. It is possible to also link to other chains by providing a full URN identifier,
Here are the identifiers and how they're used:

* JWT `id` is assigned to each verifiable credential JWT. It is used in other cached tables
as the `jwtId` (eg. in `plan_claim`). It is a ULID, a string of 26 characters like "01GQBE7Q0RQQAGJMEEW6RSGKTF".

* A `handleId` is a unique identifier used to refer to an entity which might have edits in a chain of claims.
For example, a project could be created and then later edited, and all such claims can be tied together with this.
By default, it is a global ID made out of the JWT `id`, eg. "http://endorser.ch/entity/01GQBE7Q0RQQAGJMEEW6RSGKTF",
but it might be some other global `identifier` that was supplied by the user. This is metadata, typically not set directly;
any subsequent claims sent to the server should send a `lastClaimId` to refer to the latest claim with the same `handleId`.

* An `identifier` can be supplied when submitting a claim if the client wants to use their own identifier
(such as an identifier from another chain); in those cases, it is also used as the `handleId`.
This is a full global URN. It may be a DID. When referring to preceding claims, use `lastClaimId` instead.

* A `lastClaimId` is the way to refer to a previous claim. (An `identifier` may still be accepted, but that use is deprecated.)
It is typically a ULID, the short `id` reference to another internal claim that this should extend.

  * Note that the ACDC approach has the link to previous claims outside the claim. I'm sure that will be preferable to
  this approach where the link is inside the claim.

* A `jwtId` is the `id` of the JWT that was used to submit the claim, found in the tables that cache the claim info
(eg. in `plan_claim` and other `_claim` tables).

See also: https://endorser.ch/doc/html/server.html








## Troubleshooting

- When the API disallows and says a user "has already claimed" or "has already registered" their maximum for the week, you can up their limit in the database registration table (or, if they haven't been set explicitly in the DB for that user, increase the DEFAULT_MAX settings at the top of jwt.service.js).

- Repeated sign-in (because it doesn't remember you): After sign-in, see what browser it uses after you log in from uPort, and use that from now on to start the flow.  (On some Android phones, we've noticed that it's hard to tell which browser that is because the app shows endorser.ch inside a uPort window; we eventually found it was Duck-Duck-Go... so try all the possible browsers, and watch closely as it jumps to the browser to see if there's any indication.)

- "CORS problems": is endorser-ch running?

- "Please make sure to have at least one network": this happened when we used Infura but that's not the case any more; do a case-insensitive search for the word "infura" and see what you find.

- "Unsupported DID method 'ethr'": dependencies? see https://github.com/trentlarson/endorser-ch/commit/a836946c1b1897000dbe7e6d610df32aa32742ba

- "Converting circular structure to JSON": network connected?

- "Error: expected "Content-Type" header field" during automated tests: run them again.

- This:
```
../fsevents.cc:85:58: error: expected ';' after top level declarator
void FSEvents::Initialize(v8::Handle<v8::Object> exports) {
                                                         ^
                                                         ;
23 warnings and 9 errors generated.
make: *** [Release/obj.target/fse/fsevents.o] Error 1
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
...
node-pre-gyp ERR! build error
node-pre-gyp ERR! stack Error: Failed to execute '/Users/tlarson/.nvm/versions/node/v12.13.1/bin/node /Users/tlarson/.nvm/versions/node/v12.13.1/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js ...
...
npm ERR! sqlite3@4.0.4 install: `node-pre-gyp install --fallback-to-build`
npm ERR! Exit status 1
...
```
... probably means you're running a different version of node.  Prod is on node v10.15.0 and npm 6.4.1

- This:
```
> endorser-ch@1.1.23 flyway /Users/tlarson/dev/home/endorser-ch
> flyway -c conf/flyway.js "migrate"

flyway-8.5.10/jre/lib/server/libjvm.dylib: truncated gzip input
tar: Error exit delayed from previous errors.
(node:12554) UnhandledPromiseRejectionWarning: Error: Error: Untaring file failed 1
    at /Users/tlarson/dev/home/endorser-ch/node_modules/node-flywaydb/bin/flyway.js:76:19
    at processTicksAndRejections (internal/process/task_queues.js:93:5)
(node:12554) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 1)
(node:12554) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
```
... may require removal of node_modules and reinstall.

- A timeout with tests can happen due to bad javascript, such as reference to a non-existent variable.
If you wrap the whole endpoint in a try/catch, the error result may show the error message.





## More Manual Tests

- Make sure API works: http://localhost:3000/api-explorer
- Run test/test.sh
- Test these :3001 URLs by running [the web app](https://github.com/trentlarson/uport-demo)
http://localhost:3001/reportClaim?claimId=1

... and see confirmations eventually (even if they're HIDDEN which causes console errors)
http://localhost:3001/reportClaims

... to see a list of claims
http://localhost:3001/reportConfirms

... plus push a button and see results
http://localhost:3001/signClaim?claim=%7B%22%40context%22%3A%22http%3A%2F%2Fendorser.ch%22%2C%22%40type%22%3A%22Confirmation%22%2C%22originalClaims%22%3A%5B%7B%22%40context%22%3A%22http%3A%2F%2Fschema.org%22%2C%22%40type%22%3A%22JoinAction%22%2C%22agent%22%3A%7B%22did%22%3A%22did%3Aethr%3Asomeone%22%7D%2C%22event%22%3A%7B%22organizer%22%3A%7B%22name%22%3A%22Bountiful%20Voluntaryist%20Community%22%7D%2C%22name%22%3A%22Saturday%20Morning%20Meeting%22%2C%22startTime%22%3A%222020-01-25T08%3A00%3A00.000-07%3A00%22%7D%7D%2C%7B%22%40context%22%3A%22http%3A%2F%2Fschema.org%22%2C%22%40type%22%3A%22JoinAction%22%2C%22agent%22%3A%7B%22did%22%3A%22did%3Aethr%3Asomeone-else%22%7D%2C%22event%22%3A%7B%22organizer%22%3A%7B%22name%22%3A%22Bountiful%20Voluntaryist%20Community%22%7D%2C%22name%22%3A%22Saturday%20Morning%20Meeting%22%2C%22startTime%22%3A%222020-01-25T08%3A00%3A00.000-07%3A00%22%7D%7D%2C%7B%22%40context%22%3A%22http%3A%2F%2Fschema.org%22%2C%22%40type%22%3A%22JoinAction%22%2C%22agent%22%3A%7B%22did%22%3A%22did%3Aethr%3Asomeone-else-else%22%7D%2C%22event%22%3A%7B%22organizer%22%3A%7B%22name%22%3A%22Bountiful%20Voluntaryist%20Community%22%7D%2C%22name%22%3A%22Saturday%20Morning%20Meeting%22%2C%22startTime%22%3A%222020-01-25T08%3A00%3A00.000-07%3A00%22%7D%7D%2C%7B%22%40context%22%3A%22http%3A%2F%2Fschema.org%22%2C%22%40type%22%3A%22JoinAction%22%2C%22agent%22%3A%7B%22did%22%3A%22did%3Aethr%3Asomeone-elsest%22%7D%2C%22event%22%3A%7B%22organizer%22%3A%7B%22name%22%3A%22Bountiful%20Voluntaryist%20Community%22%7D%2C%22name%22%3A%22Saturday%20Morning%20Meeting%22%2C%22startTime%22%3A%222020-01-25T08%3A00%3A00.000-07%3A00%22%7D%7D%2C%7B%22%40context%22%3A%22http%3A%2F%2Fschema.org%22%2C%22%40type%22%3A%22JoinAction%22%2C%22agent%22%3A%7B%22did%22%3A%22did%3Aethr%3AElsa's-sister%22%7D%2C%22event%22%3A%7B%22organizer%22%3A%7B%22name%22%3A%22Bountiful%20Voluntaryist%20Community%22%7D%2C%22name%22%3A%22Saturday%20Morning%20Meeting%22%2C%22startTime%22%3A%222020-01-25T08%3A00%3A00.000-07%3A00%22%7D%7D%5D%7D

... gives 5 confirmations

... and then go to a place not logged in
http://localhost:3001/reportBestAttendance

... and see all hidden

... then test the following user story if you have time.

User stories:

- in endorser-ch
  - run test/test.sh
  - run: NODE_ENV=test-local npm run dev

- in mobile app
  - change to TEST_USER_NUM = 11 (Annabelle's Friend) in src/utilities/claimsTest.js

  - run: `npm run build && npm run start`

  - show attendance results
    - on Best Attendance screen
      http://localhost:3001/reportBestAttendance
      and see all DIDs are hidden except public 22c

  - show search results for skills
    http://localhost:3001/reportSearch
    - search for "carpentry" and see all DIDs are hidden
    - run in endorser-ch: npm run set-3-visible
    - search for "carpentry" and see 332 DIDs are shown and some are transitive, eg. in identifierVisibleToDids

  - show eligibility results
    - on search screen Call Endpoint with:
      /api/report/actionClaimsAndConfirmationsSince?dateTime=2018-01-01T00:00:00Z
    - processed to see confirmations
      searchResults.map((obj) => {return {did: obj.did, numActions: obj.actions.length, numConfirms: R.sum(obj.actions.map((a)=>a.confirmations.length))}})
      ... and see 3 confirmations, two hidden and one 22c public

  - show voting results
    - see votes on search screen Call Endpoint with:
      /api/report/orgRoleClaimsAndConfirmationsOnDate?orgName=Cottonwood%20Cryptography%20Club&roleName=President&onDate=2019-06-18
    - processed to see votes
      R.map(o=>{return {did:o.did, roles:R.map(role=>{return {votes:role.confirmations.length, roleName:role.orgRole.roleName}})(o.orgRoles)}})(searchResults)
      ... and 2 results, three for hidden and two for 332

  - show tenure results and links to find people
    - go to Residence Report
      http://localhost:3001/reportResidences
    - see duplicate tenure claims, one hidden
    - change to TEST_USER_NUM = -1 (Trent) in src/utilities/claimsTest.js
    - in tenure claim, see a different user hidden
    - confirm something about Annabelle did:ethr:0xaaa29f09c29fb0666b8302b64871d7029032b479
      ... and see claim with ID 32 saved http://localhost:3001/claim?claimId=32
    - change to TEST_USER_NUM = 11 (Annabelle's Friend) in src/utilities/claimsTest.js
    - in tenure claim, go to see how there's now a reachable path to find out the other owner

- using data generated from tests

  - Users #2 & #3 want to find any common contact.

  - See some records & confirmations.
    - search on "give"
    - confirmed by me: user #2: see 0 gave 2 hours, confirmed by connections
    - hidden & linked: user #3: see ? gave 3 USD, not-visible is visible to others

  - User #2 wants to verify skills of user #3
    - find my own claim: user #3: search for carpentry, use second to last in list


This will help visualize the network from the test data:

* Get from DB: `select "{source:'" || substring(subject, 12, 1) || "', target:'" || substring(object, 12, 1) || "', type: 'suit'},"  from network;`

* Go to https://observablehq.com/@d3/mobile-patent-suits and substitute that data into the 'links' variable, wrapped in '[]'.

* See the network links at the top.


#### Test Data for Contacts

[Here is a sample CSV for contacts](https://raw.githubusercontent.com/trentlarson/endorser-ch/master/test/sample-contacts.csv), with data taken from the tests.


#### Run a single test file

```shell
test/test.sh "" test/controller1
```

### Run a single test

```shell
NODE_ENV=test-local npm test -- --grep "plansLastUpdatedBetween finds changes after initial claim"
```

#### Debug the tests

... though I just saw this in the docs and I don't really know what it means.

```shell
./test/test.sh :debug
```

#### Send sample plan

First, ensure your DID is registered (see above). Then make a claim that looks
like `claimPlanAction` in this [test file](./test/util.js), wrapped in a JWT.
Here's an example in node:

```
let claimPlanAction = {
  "@context": "https://schema.org",
  "@type": "PlanAction",
  "agent": { identifier: null }, // supply DID for intiator of this plan
  "identifier": null, // supply plan ID
  "name": "KickStarter for Time",
  "description": "Deliver the games and set them up",
  "image": "https://live.staticflickr.com/2853/9194403742_c8297b965b_b.jpg",
  "startTime": "2022-07",
  "endTime": "2023-03"
}

// generate a JWT with that payload, and POST to /api/claim:

fetch(
  "https://endorser.ch/api/claim",
  {
    method: "POST",
    header: { "Content-Type": "application/json" }
  },
  body: JSON.stringify({ jwtEncoded: jwt })
)

```

That will give you a resulting ID (or a result with an "error" property).




#### Generate JWTs

Following are a few ways to generate a JWT with contents `{a:1}`:

```shell

# Setup:
# - Run `npm install` in this project.
# - Get the endorser-mobile project, run `yarn` there, and run the following in a shell inside there.
# Note that this command may fail with a `hunk` message, but it's worth continuing because the rest may work.
npx yarn-add-no-save esm typescript ts-node tslib @types/node
# Edit tsconfig.json and set `isolatedModules` to false.
# Run the CLI:
npx ts-node

// Then run the following in that node REPL:
const testUtil = require('../endorser-ch/test/util') // import does not work

// One approach:
await testUtil.credentials[0].signJWT({a:1})

// Another approach (only needs did-jwt lib):
const didJwt = require('did-jwt')
const cred = testUtil.creds[0]
const signer = didJwt.SimpleSigner(cred.privateKey)
//const uportTokenPayload = { exp: 1, iat: 0, iss: cred.did }
await didJwt.createJWT({a:1}, { issuer: cred.did, signer })

// Another approach (not-fully-tested): use the endorser-mobile project and create an identifier and use the utility.accessToken method from this:
//import * as utility from './endorser-mobile/src/utility/utility' // require does not work

// Other approaches with did-jwt are below.

# Now you can go to a terminal and put that JWT value into a JWT env var make a call as user #0.
curl -H "Uport-Push-Token: $JWT" -H "Content-Type: application/json" https://api-test.endorser.ch/api/claims

```




#### Old basic sample

Let's create some claims. First, we'll create a claim of attendance. Here's the payload structure:

```
{
  "@context": "http://schema.org",
  "@type": "JoinAction",
  "agent": { "did": "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F" },
  "event": {
    "organizer": { "name": "Bountiful Voluntaryist Community" },
    "name": "Saturday Morning Meeting",
    "startTime": "2018-12-29T08:00:00.000-07:00"
  }
}
```

* To send to the server, package that in a JWT (see code above) and POST to the /api/claim endpoint inside a body of `{ jwtEncoded: ... }`


Now to confirm that activity, place all the previous into the `object` of an `AgreeAction`:

```
{
  "@context": "http://endorser.ch",
  "@type": "AgreeAction",
  "object": {
    "@type": "JoinAction",
    "agent": { "did": "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F" },
    "event": {
      "organizer": { "name": "Bountiful Voluntaryist Community" },
      "name": "Saturday Morning Meeting",
      "startTime": "2018-12-29T08:00:00.000-07:00"
    }
  }
}
```


#### Old extensive samples

```shell

# These JWTs are old so they'll require running in "test-local" mode.
export UPORT_PUSH_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NjAyMTI0MTMsImV4cCI6MTU2MDI5ODgxMywiaXNzIjoiZGlkOmV0aHI6MHgwMGM5YzIzMjZjNzNmNzMzODBlODQwMmIwMWRlOWRlZmNmZjJiMDY0In0.mUydq67R-gzz7c6iQBd06uKu2OEO32vqFbMWTxK3k5VUcDwFQR9XEj28KflBMmohm72nlITd_0kK0zIYSGaDwgA
# see claims
curl http://localhost:3000/api/claim -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
# register
curl http://localhost:3000/api/claim -h ...UNFINISHED: RegisterAction with agent & participant...
# create an action claim
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NzQxMzcwMDAsInN1YiI6ImRpZDpldGhyOjB4MDBjOWMyMzI2YzczZjczMzgwZTg0MDJiMDFkZTlkZWZjZmYyYjA2NCIsImNsYWltIjp7IkBjb250ZXh0IjoiaHR0cDovL3NjaGVtYS5vcmciLCJAdHlwZSI6IkpvaW5BY3Rpb24iLCJhZ2VudCI6eyJkaWQiOiJkaWQ6ZXRocjoweDAwYzljMjMyNmM3M2Y3MzM4MGU4NDAyYjAxZGU5ZGVmY2ZmMmIwNjQifSwiZXZlbnQiOnsib3JnYW5pemVyIjp7Im5hbWUiOiJCb3VudGlmdWwgVm9sdW50YXJ5aXN0IENvbW11bml0eSJ9LCJuYW1lIjoiU2F0dXJkYXkgTW9ybmluZyBNZWV0aW5nIiwic3RhcnRUaW1lIjoiMjAxOC0xMi0yOVQwODowMDowMC4wMDAtMDc6MDAifX0sImlzcyI6ImRpZDpldGhyOjB4MDBjOWMyMzI2YzczZjczMzgwZTg0MDJiMDFkZTlkZWZjZmYyYjA2NCJ9.juVv789ByzMRt7ny29TaG2jxSQ74hRjEbtbCw3XziRLCBOnHYr55puFSn24rEjPTe8QjfGy6OXptvkVdrqQfHg"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/claim/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/action/1 -H 'Uport-Push-Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTU4MDc0MTYsImV4cCI6MTU1NzEwMzQxNiwiYXVkIjoiZGlkOmV0aHI6MHg2MWU3YmFlNzM5NDZjZGY4ZWUyZWE3ZWE4ZmQzYWZjZGVlOTcxMjBhIiwidHlwZSI6Im5vdGlmaWNhdGlvbnMiLCJ2YWx1ZSI6ImFybjphd3M6c25zOnVzLXdlc3QtMjoxMTMxOTYyMTY1NTg6ZW5kcG9pbnQvR0NNL3VQb3J0L2I3ODJkNGEzLWYwYzMtM2I1OS1hMjk3LTY4ZTlmYmViYWQyOSIsImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.7GnYLHHO8gT3ApW-c3pa0FH1Yj15xDB_UJmzpiHNvqpmxMZo_CnHYxyg9R-I71CZqfiO_7X7IXhj-oCI9jzmWwE' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/claim?claimContents=Bountiful' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
# confirmation
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NzQxMzcwMDAsInN1YiI6ImRpZDpldGhyOjB4MDBjOWMyMzI2YzczZjczMzgwZTg0MDJiMDFkZTlkZWZjZmYyYjA2NCIsImNsYWltIjp7IkBjb250ZXh0IjoiaHR0cDovL2VuZG9yc2VyLmNoIiwiQHR5cGUiOiJDb25maXJtYXRpb24iLCJvcmlnaW5hbENsYWltIjp7IkBjb250ZXh0IjoiaHR0cDovL3NjaGVtYS5vcmciLCJAdHlwZSI6IkpvaW5BY3Rpb24iLCJhZ2VudCI6eyJkaWQiOiJkaWQ6ZXRocjoweGRmMGQ4ZTVmZDIzNDA4NmY2NjQ5Zjc3YmIwMDU5ZGUxYWViZDE0M2UifSwiZXZlbnQiOnsib3JnYW5pemVyIjp7Im5hbWUiOiJCb3VudGlmdWwgVm9sdW50YXJ5aXN0IENvbW11bml0eSJ9LCJuYW1lIjoiU2F0dXJkYXkgTW9ybmluZyBNZWV0aW5nIiwic3RhcnRUaW1lIjoiMjAxOC0xMi0yOVQwODowMDowMC4wMDAtMDc6MDAifX19LCJpc3MiOiJkaWQ6ZXRocjoweDAwYzljMjMyNmM3M2Y3MzM4MGU4NDAyYjAxZGU5ZGVmY2ZmMmIwNjQifQ.l5EXnyKXkoghFxloNA_2Nu2scIq75qw11BVtCyMSbhIkz4lm1IL02i_demSUoCUJgCMRUdkKmy3RIsHBMUn-IQ"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/claim?claimType=JoinAction' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/action/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/event/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/event/1/actionClaimsAndConfirmations -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"a":4\}'
curl 'http://localhost:3000/api/action?eventStartTime=2018-12-29T08:00:00.000-07:00' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
# tenure
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NzQxMzcwMDAsInN1YiI6ImRpZDpldGhyOjB4MDBjOWMyMzI2YzczZjczMzgwZTg0MDJiMDFkZTlkZWZjZmYyYjA2NCIsImNsYWltIjp7IkBjb250ZXh0IjoiaHR0cDovL2VuZG9yc2VyLmNoIiwiQHR5cGUiOiJUZW51cmUiLCJzcGF0aWFsVW5pdCI6eyJnZW8iOnsiQHR5cGUiOiJHZW9TaGFwZSIsInBvbHlnb24iOiI0MC44ODM5NDQsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0Nzg3IDQwLjg4NDA4OCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ1MTUgNDAuODgzOTQ0LC0xMTEuODg0Nzg3In19LCJwYXJ0eSI6eyJkaWQiOiJkaWQ6ZXRocjoweGRmMGQ4ZTVmZDIzNDA4NmY2NjQ5Zjc3YmIwMDU5ZGUxYWViZDE0M2UifX0sImlzcyI6ImRpZDpldGhyOjB4MDBjOWMyMzI2YzczZjczMzgwZTg0MDJiMDFkZTlkZWZjZmYyYjA2NCJ9.BfhZevLwMi48ATRvfZeJeDicbjIiruMIjBVXP__wQP-Ir8TtAf8fFC0iTDW4b6zTyZgk-YH1X781uIO4TsfBag"}' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl http://localhost:3000/api/tenure/1 -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN"
curl 'http://localhost:3000/api/report/tenureClaimsAndConfirmationsAtPoint?lat=40.883944&lon=-111.884787' -H "Uport-Push-Token: $UPORT_PUSH_TOKEN" | json_pp
curl -X POST http://localhost:3000/api/claim/makeMeGloballyVisible -H "Content-Type: application/json" -H "Uport-Push-Token: $UPORT_PUSH_TOKEN" -d '{"url":"http://IgniteCommunity.org"}'

```








## Metrics

```shell
mkdir metrics
cd metrics

# Use Node & NPM/Yarn
# ... with pkgx:
pkgx +pnpm.io sh

# this director is so it does not search in parent directories
mkdir node_modules
pnpm add bent ramda
# This is if you want to get private data. (See below, too.)
# (For some reason, I had this pegged @5.12.4)
pnpm add did-jwt

node --experimental-modules

// The rest is inside your node CLI.
//let getServer = () => { return 'http://localhost:3000' }
let getServer = () => { return 'https://api.endorser.ch' }
const bent = require('bent')
const fs = require('node:fs')
const R = require('ramda')

// This is only important if you want to get private data. (See below, too.)
const didJwt = await import('did-jwt')

// 'count' returns { data: [...], maybeMoreAfter: 'ID' }
let count = async (moreBefore, ownerDid, ownerPrivateKeyHex) => {
  let options = { "Content-Type": "application/json" }
  if (ownerDid && ownerPrivateKeyHex) {
    // This is just if you want to get private data.
    const nowEpoch = Math.floor(Date.now() / 1000)
    const endEpoch = nowEpoch + 60
    const tokenPayload = { exp: endEpoch, iat: nowEpoch, iss: ownerDid }
    const signer = didJwt.SimpleSigner(ownerPrivateKeyHex)
    const accessJwt = await didJwt.createJWT(tokenPayload, { issuer: ownerDid, signer })
    options = R.mergeLeft({ "Authorization": "Bearer " + accessJwt }, options)
  }
  const getJson = bent('json', options)
  return getJson(getServer() + '/api/v2/report/claims?beforeId=' + moreBefore)
}

let fillAll = async (ownerDid, ownerPrivateKeyHex) => {
  let moreBefore = 'Z'
  let all = []
  do {
    const result = await count(moreBefore, ownerDid, ownerPrivateKeyHex)
    all = R.concat(all, result.data)
    moreBefore = result.hitLimit ? result.data[result.data.length - 1].id : ''
    console.log(all.length, moreBefore, '...')
  } while (moreBefore)
  console.log('Grand total:', all.length)
  const totalSum = R.map(i => R.set(R.lensProp('month'), i.issuedAt.substring(0, 7), i), all)
  const grouped = R.groupBy(i => i.month, totalSum)
  const table = R.map(i => i.length, grouped)

  // output grouped totals
  console.log('Grouped:', JSON.stringify(table, null, 2))

  // output each row in CSV format
  //all.map(record => console.log(record.issuedAt.substring(0, 7), ",", record.claimType))
  return all
}

// Run without credentials for these first few numbers:
let all = await fillAll()

// Write all claims to JSON -- which is not recommended if you read with your credentials because it contains all your linkages:
//fs.writeFileSync('metrics.json', JSON.stringify(all, null, 2))
// Read them from a previous session:
//all = require('./metrics.json')

// write all claims with months & issuer & types to CSV
fs.writeFileSync('metrics.csv', 'month,issuedAt,claimType\n')
all.map(record => fs.appendFileSync('metrics.csv', record.issuedAt.substring(0, 7) + ',' + record.issuedAt + ',' + record.claimType + '\n'))

// write count per month to CSV
let monthClaims = R.countBy(R.identity, R.map(record => record.issuedAt.substring(0, 7), all))
let keys = R.keys(monthClaims).sort()
fs.writeFileSync('metrics-count.csv', 'month,count\n')
R.map(key => fs.appendFileSync('metrics-count.csv', key + ',' + monthClaims[key] + '\n'), keys)

// write counts for months & selected types to CSV
// Note: these types were not used until late 2020. (... mostly JoinAction & Confirmation)
let selectedTypes = ['GiveAction', 'Offer', 'PlanAction', 'AgreeAction']
//let selectedTypes = ['RegisterAction']
let now = new Date()
let nonEdits = R.filter(record => record.handleId.substring(27) === record.id, all)
let monthClaimsTypes = R.countBy(R.identity, R.map(record => record.issuedAt.substring(0, 7) + ',' + record.claimType, nonEdits))
fs.writeFileSync('metrics-claims-by-month-filtered.csv', 'date,' + selectedTypes.join(',') + ',total' + '\n')
for (let year = 2019; year <= now.getFullYear(); year++) {
  const highMonth = year === now.getFullYear() ? now.getMonth() : 11
  for (let month = 0; month <= highMonth; month++) {
    const monthNum = month + 1 // since getMonth is 0-based
    const monthStr = year + '-' + (monthNum < 10 ? '0' : '') + monthNum
    let row = ''
    let total = 0
    for (const type of selectedTypes) {
      const thisCount = monthClaimsTypes[monthStr + ',' + type] || 0
      row += ',' + thisCount
      total += thisCount
    }
    fs.appendFileSync('metrics-claims-by-month-filtered.csv', monthStr + row + ',' + total + '\n')
  }
}

// sum hours given to CSV
let now = new Date()
let givenHours = R.filter(
  record =>
    record.claimType === 'GiveAction'
    && record.claim.object?.unitCode === 'HUR'
    && record.claim.fulfills?.[0]?.['@type'] !== 'TradeAction',
  all
)
let monthGives = R.groupBy(record => record.issuedAt.substring(0, 7), givenHours)
fs.writeFileSync('metrics-given-hours.csv', 'month,total\n')
for (let year = 2019; year <= now.getFullYear(); year++) {
  const highMonth = year === now.getFullYear() ? now.getMonth() : 11
  for (let month = 0; month <= highMonth; month++) {
    const monthNum = month + 1 // since getMonth is 0-based
    const monthStr = year + '-' + (monthNum < 10 ? '0' : '') + monthNum
    const monthSum = R.sum((monthGives[monthStr] || []).map(r => r.claim.object?.amountOfThisGood || 0))
    fs.appendFileSync('metrics-given-hours.csv', monthStr + ',' + monthSum + '\n')
  }
}

// Now you can fill out the spreadsheet graphs.
// To edit the data ranges in LibreOffice, right-click a graph, choose "Edit", then hit "Data Rannges" icon at top.




//// The following are only available if you retrieved private data.

// Run with a DID & private key hex:
all = await fillAll('OWNER_DID', 'OWNER_PRIVATE_KEY_HEX')

// write months and issuer DIDs to CSV
fs.writeFileSync('metrics-issuer.csv', 'month,issuedAt,claimType,issuer\n')
all.map(record => fs.appendFileSync('metrics-issuer.csv', record.issuedAt.substring(0, 7) + ',' + record.issuedAt + ',' + record.claimType + ',' + record.issuer + '\n'))

// write months and number of unique DIDs
let now = new Date()
let monthUniqDids = R.uniq(R.map(record => record.issuedAt.substring(0, 7) + ',' + record.issuer, all).sort())
fs.writeFileSync('metrics-uniq-issuers.csv', 'month,known_unique_issuers\n')
for (let year = 2019; year <= now.getFullYear(); year++) {
  const highMonth = year === now.getFullYear() ? now.getMonth() : 11
  for (let month = 0; month <= highMonth; month++) {
    const monthNum = month + 1 // since getMonth is 0-based
    const monthStr = year + '-' + (monthNum < 10 ? '0' : '') + monthNum

    let count = R.filter(monthDid => monthDid.substring(0, 7) === monthStr, monthUniqDids).length
    fs.appendFileSync('metrics-uniq-issuers.csv', monthStr + ',' + count + '\n')
  }
}

// write months and number of hidden DIDs
now = new Date()
fs.writeFileSync('metrics-hidden-issuer-claims.csv', 'month,hidden_issuer_claims\n')
for (let year = 2019; year <= now.getFullYear(); year++) {
  const highMonth = year === now.getFullYear() ? now.getMonth() : 11
  for (let month = 0; month <= highMonth; month++) {
    const monthNum = month + 1 // since getMonth is 0-based
    const monthStr = year + '-' + (monthNum < 10 ? '0' : '') + monthNum

    const count = R.filter(record => record.issuedAt.substring(0, 7) === monthStr && record.issuer === 'did:none:HIDDEN', all).length
    fs.appendFileSync('metrics-hidden-issuer-claims.csv', monthStr + ',' + count + '\n')
  }
}

```

- Remember to remove the current month from results.







## Limits (Manual Tasks)

* If you increase anyone's limits, make sure to increase them in the image app as well.









## Misc




This is licensed as public domain software, but I sure would enjoy a note if you get people using it.




Note that new deployments can remove the code for: "legacy Confirmation", "legacy context"




Here's a way to verify a JWT signature.
- Go to an empty directory (where you'll install and run code)
```
yarn add did-jwt@4.0.0 ethr-did-resolver@3.0.0
node

// note that you can now use the local resolver instead of Infura; see server/did/did-eth-local-resolver.js
const infuraProjectId = '...' // get one at infura.io
const didJWT = require('did-jwt')
const Resolver = require('did-resolver').Resolver
const ethrDid = require('ethr-did-resolver').getResolver({rpcUrl: 'https://mainnet.infura.io/v3/' + infuraProjectId})
let resolver = new Resolver(ethrDid)
let result;
async function verify(jwt) {
  result = await didJWT.verifyJWT(jwt, {resolver: resolver})
  console.log("Result of 'verify':\n", result, '\n... and doc\n', result.doc);
}
```
- Finally, enter this with your JWT string: `verify("PASTE JWT HERE")`
- If you see `Signature invalid for JWT`, you're being tricked.  Otherwise, it checks out.
  - If you see some other error (eg. "expired"), that's OK... it still passed the signature check, as long as it gets past this line: https://github.com/decentralized-identity/did-jwt/blob/v4.0.0/src/JWT.ts#L231




DB Migrations:

- Add a new one with a new file in the `sql` directory where you increment the "V" number in the filename.
- Record the change in the sql/README.md file for the sake of documentation.
- `npm run flyway migrate` to run it.



DB Settings:

- `APP_DB_FILE` is used to select the DB file (see conf/flyway.js)
- `NODE_ENV` is used to determine the DB file if `APP_DB_FILE` is not set (see conf/flyway.js)





Open questions:
- Should we require top-level @context and @type (where multiple become ItemList)?
- How do I find the app address or ID? 0xa55...40b, from phone to IP: 0x669...e8a then 0x1b2...2e6
- What is the strange "notifications" JWT from 2020-01-26 21:59:50.106 ?
- Why does the did-jwt verifyJWT throw: Error: Signature invalid for JWT
  ... on this content:

```
{
  '@context': '123456789012345678',
  '@type': '123456789012',
  originalClaims: [
    {
      '@context': '12345678901234567',
      '@type': '1234567890',
      agent: {
        did: '123456789012345678901234567890123456789012345678901'
      },
      event: {
        organizer: {
          name: '12345678901234567890123456789012'
        },
        name: '123456789012345678901234',
        startTime: '12345678901234567890123456789'
      }
    }
  ]
}
```

  ... but if you add or remove a character anywhere then it validates just fine?
  (Note that I tried another 340-character string and its signature verified OK.)
  If we fix this, we can fix some hacks in SignClaim (look for "milliseconds").






## Related Work

- [Sovrin AKA Hyperledger Indy](https://sovrin.org)
  - [Verifiable Organizations Network](https://vonx.io) who showed [a mobile demo at IIW 28](https://iiw.vonx.io).
- [Accredible](https://www.accredible.com/) and their [verification system](https://verify.accredible.com) which [uses Tierion](https://help.accredible.com/hc/en-us/articles/115005058985-Manually-Verifying-Blockchain-Records)
- [Blockcerts for blockchain credentials](https://www.blockcerts.org)
- [Open Badges spec] (https://www.imsglobal.org/sites/default/files/Badges/OBv2p0Final/index.html)





## Kudos

- [Veramo.io](https://veramo.io) & [Decentralized Identity projects](https://github.com/decentralized-identity)
- https://github.com/cdimascio/generator-express-no-stress
- uport-connect classes https://github.com/uport-project/uport-connect/blob/develop/docs/reference/index.md#Connect+requestDisclosure

