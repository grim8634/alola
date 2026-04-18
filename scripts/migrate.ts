// scripts/migrate.ts — applies any migrations not yet recorded in schema_migrations
import { createClient } from '@libsql/client'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import 'dotenv/config'

async function main() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const client = createClient({ url, authToken })

  // Ensure the tracking table exists (idempotent)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const migrationsDir = resolve(process.cwd(), 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  const { rows: appliedRows } = await client.execute('SELECT name FROM schema_migrations')
  const applied = new Set(appliedRows.map(r => r.name as string))

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· skip ${file} (already applied)`)
      continue
    }
    const sql = await readFile(resolve(migrationsDir, file), 'utf8')
    // Split on `;` at end-of-line so multiple statements apply in order.
    // libSQL doesn't accept multi-statement strings via .execute().
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    for (const stmt of statements) {
      try {
        await client.execute(stmt)
      } catch (e) {
        console.error(`✗ failed in ${file}:\n${stmt}\n`, e)
        process.exit(1)
      }
    }
    await client.execute({
      sql: 'INSERT INTO schema_migrations (name) VALUES (?)',
      args: [file],
    })
    console.log(`✓ applied ${file}`)
  }

  console.log('Migrations complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
