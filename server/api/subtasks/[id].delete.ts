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

  const { rows: owner } = await db().execute({
    sql: `SELECT s.id, s.task_id FROM subtasks s
          JOIN tasks t ON t.id = s.task_id
          WHERE s.id = ? AND t.user_id = ?`,
    args: [id, userId],
  })
  if (owner.length === 0) throwApiError('not_found', 'subtask not found')
  const taskId = Number(owner[0].task_id)

  const now = Math.floor(Date.now() / 1000)
  await db().batch([
    { sql: 'DELETE FROM subtasks WHERE id = ?', args: [id] },
    { sql: 'INSERT INTO deletions (user_id, entity, entity_id, deleted_at) VALUES (?, ?, ?, ?)', args: [userId, 'subtask', id, now] },
    { sql: 'UPDATE tasks SET updated_at = ? WHERE id = ?', args: [now, taskId] },
  ])

  setResponseStatus(event, 204)
  return null
})
