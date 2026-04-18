// server/api/tasks/[id]/complete.post.ts — idempotent: setting completed_at when already set is a no-op.
import { defineEventHandler, getRouterParam } from 'h3'
import { db } from '../../../utils/db'
import { requireAuth } from '../../../utils/auth'
import { verifyCsrf } from '../../../utils/csrf'
import { rateLimit } from '../../../utils/rateLimit'
import { RATE_LIMITS } from '../../../utils/constants'
import { throwApiError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const now = Math.floor(Date.now() / 1000)
  const res = await db().execute({
    sql: `UPDATE tasks
          SET completed_at = COALESCE(completed_at, ?), updated_at = ?
          WHERE id = ? AND user_id = ?
          RETURNING id, completed_at, updated_at`,
    args: [now, now, id, userId],
  })
  if (res.rows.length === 0) throwApiError('not_found', 'task not found')
  const r = res.rows[0]
  return {
    id: Number(r.id),
    completed_at: Number(r.completed_at),
    updated_at: Number(r.updated_at),
  }
})
