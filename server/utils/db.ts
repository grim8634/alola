// server/utils/db.ts — libSQL client singleton
import { createClient, type Client } from '@libsql/client'
import { throwApiError } from './errors'

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

/** Throws not_found unless the category exists and belongs to the user. */
export async function requireOwnedCategory(userId: number, categoryId: number): Promise<void> {
  const { rows } = await db().execute({
    sql: 'SELECT id FROM categories WHERE id = ? AND user_id = ?',
    args: [categoryId, userId],
  })
  if (rows.length === 0) throwApiError('not_found', 'category not found')
}

/** True when an error is a SQLite UNIQUE constraint violation (used for idempotency races). */
export function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((e as { message?: unknown })?.message ?? ''))
}
