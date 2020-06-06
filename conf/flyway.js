
const DB_ENV = process.env.NODE_ENV || "prod"
const FILE_LOC = process.env.APP_DB_FILE || '../endorser-ch-' + DB_ENV + '.sqlite3'

// fileLoc is my own addition since I'm using this same DB info inside my services
module.exports = {
  fileLoc: FILE_LOC,
  url: 'jdbc:sqlite:' + FILE_LOC,
  schemas: 'main',
  locations: 'filesystem:./sql',
  sqlMigrationSuffix: '.sqlite3',
  user: process.env.DBUSER,
  password: process.env.DBPASS
}
