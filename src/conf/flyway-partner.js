
if (!process.env.NODE_ENV && !process.env.PARTNER_APP_DB_FILE) {
  // Express is the canonical example: http://expressjs.com/en/api.html#app.settings.table
  console.log('NODE_ENV variable or PARTNER_APP_DB_FILE variable should be set.')
  process.exit(1)
}
const FILE_LOC = process.env.PARTNER_APP_DB_FILE || '../endorser-partner-' + process.env.NODE_ENV + '.sqlite3'

// see https://github.com/markgardner/node-flywaydb/blob/HEAD/sample/config.js
// fileLoc is my own addition since I'm using this same DB info inside my services
module.exports = {
  fileLoc: FILE_LOC,
  flywayArgs: {
    url: 'jdbc:sqlite:' + FILE_LOC,
    schemas: 'main',
    locations: 'filesystem:./sql-for-partner',
    reportFilename: 'flyway-report-partner.html',
    sqlMigrationSuffixes: '.sqlite3',
    user: process.env.DBUSER,
    password: process.env.DBPASS
  },
  downloads: {
    expirationTimeInMs: -1 // -1 means never check for updates but it's not working
  },
}
