// server/api/auth/me.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { rows } = await db().execute({
    sql: 'SELECT id, email, tz FROM users WHERE id = ?',
    args: [userId],
  })
  if (rows.length === 0) {
    // Session points to a missing user — nuke the session on the client side
    // by clearing cookies and 401'ing.
    const { endSession } = await import('../../utils/auth')
    await endSession(event)
    const { throwApiError } = await import('../../utils/errors')
    throwApiError('auth_required', 'User not found')
  }
  return {
    id: Number(rows[0].id),
    email: rows[0].email as string,
    tz: rows[0].tz as string,
  }
})
