// server/api/keys/index.post.ts — mint an API key. Plaintext returned once; never retrievable again.
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { requireString } from '../../utils/validation'
import { generateKey } from '../../utils/apiKeys'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const body = await readBody(event)
  const name = requireString(body?.name, 'name', { min: 1, max: 80 })

  const { plaintext, prefix, hash } = generateKey()
  const { lastInsertRowid } = await db().execute({
    sql: 'INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)',
    args: [userId, name, hash, prefix],
  })

  setResponseStatus(event, 201)
  return {
    key: {
      id: Number(lastInsertRowid),
      name,
      key_prefix: prefix,
      created_at: Math.floor(Date.now() / 1000),
      last_used_at: null,
      revoked_at: null,
    },
    // The plaintext is returned ONCE. Client must copy it immediately.
    plaintext,
  }
})
