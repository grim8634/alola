import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const { rows: owned } = await db().execute({
    sql: 'SELECT id FROM categories WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })
  if (owned.length === 0) throwApiError('not_found', 'category not found')

  const now = Math.floor(Date.now() / 1000)
  // Bump child tasks' updated_at before deleting the category so delta-sync sees the SET NULL effect.
  await db().batch([
    { sql: 'UPDATE tasks SET updated_at = ? WHERE user_id = ? AND category_id = ?', args: [now, userId, id] },
    { sql: 'DELETE FROM categories WHERE id = ? AND user_id = ?', args: [id, userId] },
  ])
  setResponseStatus(event, 204)
  return null
})
