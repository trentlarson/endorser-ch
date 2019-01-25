# endorser-ch

Server for recording assertions and reporting on signatures

`Created from https://github.com/cdimascio/generator-express-no-stress`

## Get Started

Get started developing...

```shell
# install deps
npm ci

# setup DB
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
npm run compile
npm start
```

## Test It

Run the Mocha unit tests

```shell
npm test
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
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMzMzIsImV4cCI6MTU0NzQ0OTczMiwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsImNsYWltRW5jb2RlZCI6ImV5SkFZMjl1ZEdWNGRDSTZJbWgwZEhBNkx5OXpZMmhsYldFdWIzSm5JaXdpUUhSNWNHVWlPaUpLYjJsdVFXTjBhVzl1SWl3aVlXZGxiblFpT25zaVpHbGtJam9pWkdsa09tVjBhSEk2TUhoa1pqQmtPR1UxWm1ReU16UXdPRFptTmpZME9XWTNOMkppTURBMU9XUmxNV0ZsWW1ReE5ETmxJbjBzSW1WMlpXNTBJanA3SW05eVoyRnVhWHBsY2lJNmV5SnVZVzFsSWpvaVFtOTFiblJwWm5Wc0lGWnZiSFZ1ZEdGeWVXbHpkQ0JEYjIxdGRXNXBkSGtpZlN3aWJtRnRaU0k2SWxOaGRIVnlaR0Y1SUUxdmNtNXBibWNnVFdWbGRHbHVaeUlzSW5OMFlYSjBWR2x0WlNJNklqSXdNVGd0TVRJdE1qbFVNRGc2TURBNk1EQXVNREF3TFRBM09qQXdJbjE5In0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.JzDwaMO1omEdWvUD3yeG4atZypQAondyPnzYpZUbLf5QW6-B_P5xHu5th7s9uhdiYPhxoRLMBDjeQH2UzOgydQA"}'
curl http://localhost:3000/api/claim?claimType=JoinAction
curl http://localhost:3000/api/action/1
curl http://localhost:3000/api/event/1
curl http://localhost:3000/api/event/1/actionClaimsAndConfirmations
curl http://localhost:3000/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00
curl 'http://localhost:3000/api/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"a":4\}'

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

## ToDo


- fix error: user claims & confirmations not showing (currently by non-subject should be by issuer)
-- add action_claim.startDateCanonical
   - and fill it
-- confirmation.did -> confirmation.agentDid
   - and fill it
-- add confirmation.issuer
   - and fill it
-- add jwt.issuer
   - and fill it
-- add created date to each record
   - and fill it
-- remove action.claimEncoded, confirmation.origClaimEncoded, jwt.claimEncoded
- fix mobile display
  - in browser, to get the RHS to all show, turned off these in the second-to-last "inherited from" style: flex-direction & webkit-flex-direction and justify-content & webkit-justify-content
- deploy at endorser.ch
--- above is necessary for release to Voluntaryists
- try-catch around jwt.service resolveAuthenticator when not connected to internet
- neo4j
- report page: who has confirmations for an activity, test various data combinations (eg. action confirmed by self)
- report page: who has the most activity for a time range
- explore page: add # of confirmations, & DIDs (after they click on the previous claim?)
- given a user who has a claim, find if anyone in my network endorses them for that
- gotta report errors to user (eg. "encoded" instead of "jwtEncoded", no event found)
- change the storage in JWT table to have original claim (eg for Confirmations)
- make record IDs into hashes not sequentially increasing numbers
- confirm Attended Action, but just show confirmation numbers (?)
- tests: see above; duplicate JWT data; ACACs by different times
- remove duplicate decode in JWT service
- limit JWT retrieval to a date
- reject duplicate claim submissions

- How do I find the app address or ID? 0xa55...40b, from phone to IP: 0x669...e8a then 0x1b2...2e6

