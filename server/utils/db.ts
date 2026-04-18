// server/utils/db.ts — libSQL client singleton
import { createClient, type Client } from '@libsql/client'

let _client: Client | null = null

export function db(): Client {
  if (_client) return _client
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  _client = createClient({ url, authToken })
  return _client
}
