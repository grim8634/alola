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

  const body = await readBody(event)
  const sets: string[] = []
  const args: unknown[] = []

  const title = optionalString(body?.title, 'title', { max: 500 })
  if (title !== undefined) { sets.push('title = ?'); args.push(title) }

  if ('notes' in (body ?? {})) {
    // Allow explicit clearing via null.
    const n = body.notes === null ? null : optionalString(body.notes, 'notes', { max: 10_000 }) ?? null
    sets.push('notes = ?'); args.push(n)
  }

  if ('category_id' in (body ?? {})) {
    const c = body.category_id === null ? null : optionalInt(body.category_id, 'category_id')
    sets.push('category_id = ?'); args.push(c ?? null)
  }

  const priority = optionalInt(body?.priority, 'priority', { min: 1, max: 3 })
  if (priority !== undefined) { sets.push('priority = ?'); args.push(priority) }

  if ('due_at' in (body ?? {})) {
    const d = body.due_at === null ? null : optionalInt(body.due_at, 'due_at')
    sets.push('due_at = ?'); args.push(d ?? null)
  }

  const position = optionalInt(body?.position, 'position', { min: 0 })
  if (position !== undefined) { sets.push('position = ?'); args.push(position) }

  if (sets.length === 0) throwApiError('validation_failed', 'no fields to update')

  sets.push('updated_at = ?')
  args.push(Math.floor(Date.now() / 1000))

  args.push(id, userId)
  const res = await db().execute({
    sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?
          RETURNING id, category_id, title, notes, priority, due_at, completed_at, position, client_id, created_at, updated_at`,
    args,
  })
  if (res.rows.length === 0) throwApiError('not_found', 'task not found')
  const r = res.rows[0]

  const { rows: subs } = await db().execute({
    sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
          FROM subtasks WHERE task_id = ? ORDER BY position ASC, created_at ASC`,
    args: [id],
  })

  return {
    task: {
      id: Number(r.id),
      category_id: r.category_id === null ? null : Number(r.category_id),
      title: r.title as string,
      notes: (r.notes as string) ?? null,
      priority: Number(r.priority),
      due_at: r.due_at === null ? null : Number(r.due_at),
      completed_at: r.completed_at === null ? null : Number(r.completed_at),
      position: Number(r.position),
      client_id: r.client_id,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
      subtasks: subs.map(s => ({
        id: Number(s.id),
        task_id: Number(s.task_id),
        title: s.title as string,
        completed_at: s.completed_at === null ? null : Number(s.completed_at),
        position: Number(s.position),
        client_id: s.client_id,
        created_at: Number(s.created_at),
        updated_at: Number(s.updated_at),
      })),
    },
  }
})
