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

  const { rows } = await db().execute({
    sql: `SELECT s.id, s.task_id, s.completed_at FROM subtasks s
          JOIN tasks t ON t.id = s.task_id
          WHERE s.id = ? AND t.user_id = ?`,
    args: [id, userId],
  })
  if (rows.length === 0) throwApiError('not_found', 'subtask not found')
  const current = rows[0].completed_at === null ? null : Number(rows[0].completed_at)
  const taskId = Number(rows[0].task_id)

  const now = Math.floor(Date.now() / 1000)
  const next = current === null ? now : null

  const { rows: upd } = await db().execute({
    sql: `UPDATE subtasks SET completed_at = ?, updated_at = ? WHERE id = ?
          RETURNING id, task_id, title, completed_at, position, client_id, created_at, updated_at`,
    args: [next, now, id],
  })
  await db().execute({ sql: 'UPDATE tasks SET updated_at = ? WHERE id = ?', args: [now, taskId] })

  const r = upd[0]
  return {
    subtask: {
      id: Number(r.id),
      task_id: Number(r.task_id),
      title: r.title as string,
      completed_at: r.completed_at === null ? null : Number(r.completed_at),
      position: Number(r.position),
      client_id: r.client_id,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    },
  }
})
