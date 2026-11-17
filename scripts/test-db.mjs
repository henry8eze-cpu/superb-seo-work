// Starts a throwaway local Postgres for tests and local development.
// Usage: node scripts/test-db.mjs  (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from 'embedded-postgres'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const port = Number(process.env.TEST_DB_PORT || 54329)
// Outside the project, so the Next.js file watcher does not rebuild on every database write.
const dir = path.join(tmpdir(), 'suprb-local-db')

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
})

rmSync(dir, { recursive: true, force: true })
await pg.initialise()
await pg.start()
await pg.createDatabase('marketplace')
console.log(`READY postgresql://postgres:postgres@localhost:${port}/marketplace`)

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
