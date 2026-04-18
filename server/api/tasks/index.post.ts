// server/api/tasks/index.post.ts — create a task (+ optional inline subtasks). Idempotent on client_id.
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import {
  requireString, optionalString, optionalInt, requireInt,
} from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

async function readTaskRow(userId: number, id: number) {
  const { rows } = await db().execute({
    sql: `SELECT id, category_id, title, notes, priority, due_at, completed_at, position, client_id, created_at, updated_at
          FROM tasks WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  })
  return rows[0] ?? null
}

async function readSubtaskRows(taskId: number) {
  const { rows } = await db().execute({
    sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
          FROM subtasks WHERE task_id = ? ORDER BY position ASC, created_at ASC`,
    args: [taskId],
  })
  return rows
}

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const body = await readBody(event)
  const clientId = requireString(body?.client_id, 'client_id', { min: 8, max: 64 })
  const title = requireString(body?.title, 'title', { min: 1, max: 500 })
  const notes = optionalString(body?.notes, 'notes', { max: 10_000 })
  const categoryId = optionalInt(body?.category_id, 'category_id')
  const priority = optionalInt(body?.priority, 'priority', { min: 1, max: 3 }) ?? 2
  const dueAt = optionalInt(body?.due_at, 'due_at')

  // Idempotency: same (user_id, client_id) → return existing row with 200.
  const { rows: existingRows } = await db().execute({
    sql: 'SELECT id FROM tasks WHERE user_id = ? AND client_id = ?',
    args: [userId, clientId],
  })
  if (existingRows.length > 0) {
    const existingId = Number(existingRows[0].id)
    const r = await readTaskRow(userId, existingId)
    const subs = await readSubtaskRows(existingId)
    setResponseStatus(event, 200)
    return {
      task: buildTaskDto(r!, subs),
    }
  }

  const { lastInsertRowid } = await db().execute({
    sql: `INSERT INTO tasks (user_id, category_id, title, notes, priority, due_at, client_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, categoryId ?? null, title, notes ?? null, priority, dueAt ?? null, clientId],
  })
  const taskId = Number(lastInsertRowid)

  // Optional inline subtasks.
  const inlineSubs = Array.isArray(body?.subtasks) ? body.subtasks : []
  for (const s of inlineSubs) {
    const subClientId = requireString(s?.client_id, 'subtasks[].client_id', { min: 8, max: 64 })
    const subTitle = requireString(s?.title, 'subtasks[].title', { min: 1, max: 300 })
    const subPosition = optionalInt(s?.position, 'subtasks[].position', { min: 0 }) ?? 0
    await db().execute({
      sql: 'INSERT INTO subtasks (task_id, title, position, client_id) VALUES (?, ?, ?, ?)',
      args: [taskId, subTitle, subPosition, subClientId],
    })
  }

  const r = await readTaskRow(userId, taskId)
  const subs = await readSubtaskRows(taskId)
  setResponseStatus(event, 201)
  return { task: buildTaskDto(r!, subs) }
})

function buildTaskDto(r: any, subs: any[]) {
  return {
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
  }
}
