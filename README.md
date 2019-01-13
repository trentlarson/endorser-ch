# endorser-ch

Server for recording assertions and reporting on signatures

`Created from https://github.com/cdimascio/generator-express-no-stress`

## Get Started

Get started developing...

```shell
# install deps
npm ci

# setup DB
DBUSER=sa DBPASS=sasa npm run migrate
# note that it fails if you don't run `npm ci`; `npm install` isn't enough (Ug!)

# run in development mode
PORT=3001 npm run dev

# run tests
npm run test
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
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"encoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMyMDQsImV4cCI6MTU0NzQ0OTYwNCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.uwutl2jx7lHqLeDRbEv6mKxUSUY75X91g-V0fpJcKZ2dO9jUYnZ9VEkS7rpsD8lcdYoQ7f5H8_3LT_vhqE-9UgA"}'
curl http://localhost:3000/api/claim/1
curl http://localhost:3000/api/claim -H "Content-Type: application/json" -d '{"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMzMzIsImV4cCI6MTU0NzQ0OTczMiwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsImNsYWltRW5jb2RlZCI6ImV5SkFZMjl1ZEdWNGRDSTZJbWgwZEhBNkx5OXpZMmhsYldFdWIzSm5JaXdpUUhSNWNHVWlPaUpLYjJsdVFXTjBhVzl1SWl3aVlXZGxiblFpT25zaVpHbGtJam9pWkdsa09tVjBhSEk2TUhoa1pqQmtPR1UxWm1ReU16UXdPRFptTmpZME9XWTNOMkppTURBMU9XUmxNV0ZsWW1ReE5ETmxJbjBzSW1WMlpXNTBJanA3SW05eVoyRnVhWHBsY2lJNmV5SnVZVzFsSWpvaVFtOTFiblJwWm5Wc0lGWnZiSFZ1ZEdGeWVXbHpkQ0JEYjIxdGRXNXBkSGtpZlN3aWJtRnRaU0k2SWxOaGRIVnlaR0Y1SUUxdmNtNXBibWNnVFdWbGRHbHVaeUlzSW5OMFlYSjBWR2x0WlNJNklqSXdNVGd0TVRJdE1qbFVNRGc2TURBNk1EQXVNREF3TFRBM09qQXdJbjE5In0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.JzDwaMO1omEdWvUD3yeG4atZypQAondyPnzYpZUbLf5QW6-B_P5xHu5th7s9uhdiYPhxoRLMBDjeQH2UzOgydQA"}'

# clean out and recreate DB
rm ../endorser-ch.sqlite3
DBUSER=sa DBPASS=sasa npm run migrate
```


## Try It

See API docs: http://localhost:3001/api-docs

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

- gotta report errors to user (eg. "encoded" instead of "jwtEncoded", no event found)
- confirm Attended Action, but just show confirmation numbers
- tests: see above; duplicate JWT data
- remove duplicate decode in JWT service
- limit JWT retrieval to a date
- reject duplicate JWT submissions
- allow for event time to check against true time (store as seconds? ug)
