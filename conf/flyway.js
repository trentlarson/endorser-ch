
//url: `jdbc:postgresql://${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`,
module.exports = {
	url: 'jdbc:sqlite:../endorser-ch.sqlite3',
	schemas: 'main',
	locations: 'filesystem:./sql',
	sqlMigrationSuffix: '.sqlite3',
	user: process.env.DBUSER,
	password: process.env.DBPASSWORD
}
