// server/api/keys/index.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  const { rows } = await db().execute({
    sql: `SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
          FROM api_keys WHERE user_id = ?
          ORDER BY revoked_at IS NULL DESC, created_at DESC`,
    args: [userId],
  })
  return {
    keys: rows.map(r => ({
      id: Number(r.id),
      name: r.name as string,
      key_prefix: r.key_prefix as string,
      created_at: Number(r.created_at),
      last_used_at: r.last_used_at === null ? null : Number(r.last_used_at),
      revoked_at: r.revoked_at === null ? null : Number(r.revoked_at),
    })),
  }
})
