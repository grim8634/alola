import { defineEventHandler, readBody, getRouterParam, setResponseStatus } from 'h3'
import { db, isUniqueViolation } from '../../../utils/db'
import { requireAuth } from '../../../utils/auth'
import { verifyCsrf } from '../../../utils/csrf'
import { rateLimit } from '../../../utils/rateLimit'
import { RATE_LIMITS } from '../../../utils/constants'
import { requireString, optionalInt } from '../../../utils/validation'
import { throwApiError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const taskId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(taskId)) throwApiError('validation_failed', 'id must be a number')

  const { rows: owner } = await db().execute({
    sql: 'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
    args: [taskId, userId],
  })
  if (owner.length === 0) throwApiError('not_found', 'task not found')

  const body = await readBody(event)
  const clientId = requireString(body?.client_id, 'client_id', { min: 8, max: 64 })
  const title = requireString(body?.title, 'title', { min: 1, max: 300 })
  const position = optionalInt(body?.position, 'position', { min: 0 }) ?? 0

  const { rows: existing } = await db().execute({
    sql: 'SELECT id FROM subtasks WHERE task_id = ? AND client_id = ?',
    args: [taskId, clientId],
  })
  if (existing.length > 0) {
    const { rows } = await db().execute({
      sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
            FROM subtasks WHERE id = ?`,
      args: [Number(existing[0].id)],
    })
    setResponseStatus(event, 200)
    return { subtask: dto(rows[0]) }
  }

  let lastInsertRowid: bigint | undefined
  try {
    ({ lastInsertRowid } = await db().execute({
      sql: 'INSERT INTO subtasks (task_id, title, position, client_id) VALUES (?, ?, ?, ?)',
      args: [taskId, title, position, clientId],
    }))
  } catch (e) {
    // Concurrent request with the same client_id won the race — return its row idempotently.
    if (isUniqueViolation(e)) {
      const { rows } = await db().execute({
        sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
              FROM subtasks WHERE task_id = ? AND client_id = ?`,
        args: [taskId, clientId],
      })
      if (rows.length > 0) {
        setResponseStatus(event, 200)
        return { subtask: dto(rows[0]) }
      }
    }
    throw e
  }
  // Bump parent task's updated_at so delta sync notices the change.
  await db().execute({
    sql: 'UPDATE tasks SET updated_at = ? WHERE id = ?',
    args: [Math.floor(Date.now() / 1000), taskId],
  })

  const { rows } = await db().execute({
    sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
          FROM subtasks WHERE id = ?`,
    args: [Number(lastInsertRowid)],
  })
  setResponseStatus(event, 201)
  return { subtask: dto(rows[0]) }
})

function dto(r: any) {
  return {
    id: Number(r.id),
    task_id: Number(r.task_id),
    title: r.title as string,
    completed_at: r.completed_at === null ? null : Number(r.completed_at),
    position: Number(r.position),
    client_id: r.client_id,
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  }
}
