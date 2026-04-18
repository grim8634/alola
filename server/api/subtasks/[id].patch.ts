import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { optionalString, optionalInt } from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  // Ownership check via parent task.
  const { rows: owner } = await db().execute({
    sql: `SELECT s.id, s.task_id FROM subtasks s
          JOIN tasks t ON t.id = s.task_id
          WHERE s.id = ? AND t.user_id = ?`,
    args: [id, userId],
  })
  if (owner.length === 0) throwApiError('not_found', 'subtask not found')
  const taskId = Number(owner[0].task_id)

  const body = await readBody(event)
  const sets: string[] = []
  const args: unknown[] = []

  const title = optionalString(body?.title, 'title', { max: 300 })
  if (title !== undefined) { sets.push('title = ?'); args.push(title) }

  const position = optionalInt(body?.position, 'position', { min: 0 })
  if (position !== undefined) { sets.push('position = ?'); args.push(position) }

  if ('completed_at' in (body ?? {})) {
    const c = body.completed_at === null ? null : optionalInt(body.completed_at, 'completed_at')
    sets.push('completed_at = ?'); args.push(c ?? null)
  }

  if (sets.length === 0) throwApiError('validation_failed', 'no fields to update')

  const now = Math.floor(Date.now() / 1000)
  sets.push('updated_at = ?'); args.push(now)
  args.push(id)

  const { rows } = await db().execute({
    sql: `UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?
          RETURNING id, task_id, title, completed_at, position, client_id, created_at, updated_at`,
    args,
  })
  await db().execute({ sql: 'UPDATE tasks SET updated_at = ? WHERE id = ?', args: [now, taskId] })

  const r = rows[0]
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
