// server/api/tasks/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const { rows } = await db().execute({
    sql: `SELECT id, category_id, title, notes, priority, due_at, completed_at, position, client_id, created_at, updated_at
          FROM tasks WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  })
  if (rows.length === 0) throwApiError('not_found', 'task not found')
  const r = rows[0]

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
