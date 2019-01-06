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

```shell
curl http://localhost:3000/api/jwt -H "Content-Type: application/json" -d '{"encoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDYzOTc2NTksImV4cCI6MTU0NjQ4NDA1OSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiQXR0ZW5kZWRBY3Rpb24iLCJhZ2VudCI6eyJAdHlwZSI6IlBlcnNvbiIsImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJvYmplY3QiOnsiQHR5cGUiOiJFdmVudCIsIm5hbWUiOiJCb3VudGlmdWwgVm9sdW50YXJ5aXN0IENvbW11bml0eSBTYXR1cmRheSBtb3JuaW5nIG1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLTA3In19LCJpc3MiOiJkaWQ6ZXRocjoweGRmMGQ4ZTVmZDIzNDA4NmY2NjQ5Zjc3YmIwMDU5ZGUxYWViZDE0M2UifQ.XCIOxJFWpW1K8X_Ryld6aWPSkShG9NzHietkdWImEO0Jt_dFzbJgyyDkFLq5AQYfCpibG3mlA0-_CGACXYS2mwA"}'
curl http://localhost:3000/api/jwt/1
curl http://localhost:3000/api/jwt/attendance -H "Content-Type: application/json" -d '{"encoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDYzOTc2NTksImV4cCI6MTU0NjQ4NDA1OSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiQXR0ZW5kZWRBY3Rpb24iLCJhZ2VudCI6eyJAdHlwZSI6IlBlcnNvbiIsImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJvYmplY3QiOnsiQHR5cGUiOiJFdmVudCIsIm5hbWUiOiJCb3VudGlmdWwgVm9sdW50YXJ5aXN0IENvbW11bml0eSBTYXR1cmRheSBtb3JuaW5nIG1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLTA3In19LCJpc3MiOiJkaWQ6ZXRocjoweGRmMGQ4ZTVmZDIzNDA4NmY2NjQ5Zjc3YmIwMDU5ZGUxYWViZDE0M2UifQ.XCIOxJFWpW1K8X_Ryld6aWPSkShG9NzHietkdWImEO0Jt_dFzbJgyyDkFLq5AQYfCpibG3mlA0-_CGACXYS2mwA"}'

# clean out and recreate DB
rm ../endorser-ch.sqlite3
DBUSER=sa DBPASS=sasa npm run migrate
```


## Try It
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

- tests: see above; duplicate JWT data
- remove duplicate decode in JWT service
- limit JWT retrieval to a date
- verify JWT before storing
