require('dotenv').config()

module.exports = {
  direction: 'up',
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
  databaseUrl: "postgresql://"
        + process.env.DATABASE_USER
        + ":" + process.env.DATABASE_PASSWORD
        + "@" + process.env.DATABASE_HOST
        + ":" + process.env.DATABASE_PORT + "/" + process.env.DATABASE_NAME,
  schema: 'public',
}
