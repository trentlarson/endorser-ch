
if (!process.env.NODE_ENV) {
  // Express is the canonical example: http://expressjs.com/en/api.html#app.settings.table
  console.log('NODE_ENV variable should be set.')
  process.exit(1)
}
const FILE_LOC = process.env.APP_DB_FILE || '../endorser-ch-' + process.env.NODE_ENV + '.sqlite3'

// fileLoc is my own addition since I'm using this same DB info inside my services
module.exports = {
  fileLoc: FILE_LOC,
  flywayArgs: {
    url: 'jdbc:sqlite:' + FILE_LOC,
    schemas: 'main',
    locations: 'filesystem:./sql',
    sqlMigrationSuffixes: '.sqlite3',
    user: process.env.DBUSER,
    password: process.env.DBPASS
  }
}
