import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { requireString, optionalInt, requireHexColor } from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const body = await readBody(event)
  const name = requireString(body?.name, 'name', { min: 1, max: 60 })
  const color = requireHexColor(body?.color, 'color')
  const position = optionalInt(body?.position, 'position', { min: 0 }) ?? 0

  try {
    const { lastInsertRowid } = await db().execute({
      sql: 'INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)',
      args: [userId, name, color, position],
    })
    const id = Number(lastInsertRowid)
    setResponseStatus(event, 201)
    return {
      category: {
        id, name, color, position,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      },
    }
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throwApiError('validation_failed', `a category named "${name}" already exists`)
    }
    throw e
  }
})
