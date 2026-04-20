// server/api/auth/me.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { endSession } from '../../utils/auth'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  const { rows } = await db().execute({
    sql: 'SELECT id, email, tz FROM users WHERE id = ?',
    args: [userId],
  })
  if (rows.length === 0) {
    // Session points to a missing user — clear the cookies and 401.
    await endSession(event)
    throwApiError('auth_required', 'User not found')
  }
  return {
    id: Number(rows[0].id),
    email: rows[0].email as string,
    tz: rows[0].tz as string,
  }
})
