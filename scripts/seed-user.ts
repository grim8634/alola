// scripts/seed-user.ts — creates the single user + default categories; or with --reset, rotates the password
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const DEFAULT_CATEGORIES = [
  { name: 'Scouts',   color: '#4a7c59', position: 0 },
  { name: 'KMRT',     color: '#3b82f6', position: 1 },
  { name: 'Work',     color: '#8b5cf6', position: 2 },
  { name: 'Personal', color: '#e879c8', position: 3 },
]

async function main() {
  const reset = process.argv.includes('--reset')
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  const email = process.env.SEED_USER_EMAIL
  const password = process.env.SEED_USER_PASSWORD

  if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }
  if (!email) { console.error('SEED_USER_EMAIL not set'); process.exit(1) }
  if (!password) { console.error('SEED_USER_PASSWORD not set'); process.exit(1) }

  const client = createClient({ url, authToken })
  const hash = await bcrypt.hash(password, 12)

  const { rows } = await client.execute('SELECT id FROM users LIMIT 1')

  if (rows.length > 0) {
    const userId = rows[0].id as number
    if (!reset) {
      console.error(`A user already exists (id ${userId}). Pass --reset to rotate their password.`)
      process.exit(1)
    }
    await client.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [hash, userId],
    })
    console.log(`✓ reset password for user ${userId}`)
    return
  }

  // Insert user
  const { lastInsertRowid } = await client.execute({
    sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    args: [email, hash],
  })
  const userId = Number(lastInsertRowid)
  console.log(`✓ created user ${userId} (${email})`)

  // Seed default categories
  for (const cat of DEFAULT_CATEGORIES) {
    await client.execute({
      sql: 'INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)',
      args: [userId, cat.name, cat.color, cat.position],
    })
  }
  console.log(`✓ seeded ${DEFAULT_CATEGORIES.length} categories`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
