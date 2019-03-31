# endorser-ch

A server for recording assertions and then reporting on them

This is simply an API for creating and querying claims.  For a full system, combine with https://github.com/trentlarson/uport-demo





## Get Started

Get started developing...

```shell
# install dependencies
npm ci

# setup DB
NODE_ENV=dev DBUSER=sa DBPASS=sasa npm run migrate
# note that it fails if you don't run `npm ci`; `npm install` isn't enough (Ug!)

# set up the environment
cp .env.local .env

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
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg0ODQxMTEsImV4cCI6MTU0ODU3MDUxMSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fX0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.5l1NTMNk0rxBm9jj91hFnT3P463aYELbmPVeQcFCkHZ2Gj9sP3FgbidCI69AeSArAVKvvRGAjcifJ94UtiEdfAA"}'
curl http://localhost:3000/api/claim?claimType=JoinAction
curl http://localhost:3000/api/action/1
curl http://localhost:3000/api/event/1
curl http://localhost:3000/api/event/1/actionClaimsAndConfirmations
curl 'http://localhost:3000/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00'
curl 'http://localhost:3000/api/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"a":4\}'
curl 'http://localhost:3000/api/action?eventStartTime=2018-12-29T08:00:00.000-07:00'

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


## ToDo


next deploy:
- check DB changes


- 90 3 neo4j
- 80 5 uport: inside JSON payload, show a name if DID matches a contact
- 80 0 fix API docs http://localhost:3000/api-explorer/ (linked from main page)
- 60 6 all functionality in uport
- 70 0 if there's already a response JWT & message then a new one might not show
- 70 0 retrieve dates as full ISO dates (eg for confirmations), not dates without timestamp
- 70 0 ensure JWT subject is counted as a confirmation
- 70 0 bug when a claim is duplicated
- 70 1 run tests while disconnected from the internet
- 85 0 fix error: user claims & confirmations not showing (currently by non-subject should be by issuer)
- 90 0 add helmet
- 90 1 run prod in prod mode (ie. not: npm run dev)
- 80 1 db
-- add action_claim.startDateCanonical
   - and fill it
-- add created date to each record
   - and fill it
-- remove jwt.claimEncoded
- 70 0 usability: fade out the confirmation button when pushed
- on uport-demo: change store/play pics in Welcome.js to local files
- in confirmation, check whether it really is a JoinAction
- try-catch around jwt.service resolveAuthenticator when not connected to internet
- after signing a claim, signing another claim doesn't even hit the server until page refresh
- report page: who has confirmations for an activity, test various data combinations (eg. action confirmed by self)
- report page: who has the most activity for a time range
- explore page: add # of confirmations, & DIDs (after they click on the previous claim?)
- given a user who has a claim, find if anyone in my network endorses them for that
- gotta report errors to user (eg. "encoded" instead of "jwtEncoded", no event found, context URL that's not recognized)
- change the storage in JWT table to have original claim (eg for Confirmations)
- make record IDs into hashes not sequentially increasing numbers
- confirm Attended Action, but just show confirmation numbers (?)
- tests: see above; duplicate JWT data; ACACs by different times; no claim in JWT
- remove duplicate decode in JWT service
- limit JWT retrieval to a date
- reject duplicate claim submissions
- handle "access_denied" when person rejects claim on phone

- How do I find the app address or ID? 0xa55...40b, from phone to IP: 0x669...e8a then 0x1b2...2e6

