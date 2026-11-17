// Starts a throwaway Postgres for the test run and applies the real migrations.
import EmbeddedPostgres from 'embedded-postgres'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { Client } from 'pg'

export default async function setup() {
  const port = Number(process.env.TEST_DB_PORT || 54330)
  const dir = path.join(tmpdir(), 'suprb-vitest-db')
  rmSync(dir, { recursive: true, force: true })

  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: true, onLog: () => {} })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('test')

  const client = new Client({ connectionString: `postgresql://postgres:postgres@localhost:${port}/test` })
  await client.connect()
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations')
  for (const name of readdirSync(migrationsDir).filter((n) => !n.endsWith('.toml')).sort()) {
    await client.query(readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8'))
  }
  await client.end()

  return async () => {
    await pg.stop()
    // Windows can keep the data directory locked for a moment after shutdown; the next run clears it anyway.
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
  }
}
