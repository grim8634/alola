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

  // Collect subtask ids first so we can tombstone them — they cascade-delete but the
  // deletions log needs explicit rows for delta sync in Plan 3.
  const { rows: subs } = await db().execute({
    sql: 'SELECT id FROM subtasks WHERE task_id = ?',
    args: [id],
  })

  const res = await db().execute({
    sql: 'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    args: [id, userId],
  })
  if (res.rowsAffected === 0) throwApiError('not_found', 'task not found')

  const now = Math.floor(Date.now() / 1000)
  const batch: { sql: string; args: unknown[] }[] = []
  batch.push({
    sql: 'INSERT INTO deletions (user_id, entity, entity_id, deleted_at) VALUES (?, ?, ?, ?)',
    args: [userId, 'task', id, now],
  })
  for (const s of subs) {
    batch.push({
      sql: 'INSERT INTO deletions (user_id, entity, entity_id, deleted_at) VALUES (?, ?, ?, ?)',
      args: [userId, 'subtask', Number(s.id), now],
    })
  }
  if (batch.length > 0) await db().batch(batch)

  setResponseStatus(event, 204)
  return null
})
