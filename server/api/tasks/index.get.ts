// server/api/tasks/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import {
  startOfTodayInTz, startOfDayPlusInTz, startOfNextWeekInTz,
} from '../../utils/datetime'
import { optionalEnum, optionalInt } from '../../utils/validation'

const VIEWS = ['today', 'overdue', 'week', 'all'] as const

async function userTz(userId: number): Promise<string> {
  const { rows } = await db().execute({ sql: 'SELECT tz FROM users WHERE id = ?', args: [userId] })
  return (rows[0]?.tz as string) ?? 'Europe/London'
}

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const q = getQuery(event)

  const view = optionalEnum(q.view, 'view', VIEWS) ?? 'all'
  const categoryId = optionalInt(q.category_id, 'category_id')
  const since = optionalInt(q.since, 'since', { min: 0 })

  const tz = await userTz(userId)
  const startOfToday = startOfTodayInTz(tz)
  const startOfTomorrow = startOfDayPlusInTz(tz, 1)
  const startOfNextWeek = startOfNextWeekInTz(tz)

  // Base visibility: not completed OR completed on/after today.
  const where: string[] = ['user_id = ?']
  const args: unknown[] = [userId]

  // Auto-hide completed-before-today regardless of view (but keep completed-today visible).
  where.push('(completed_at IS NULL OR completed_at >= ?)')
  args.push(startOfToday)

  if (view === 'today') {
    where.push('(due_at IS NULL OR due_at < ?)')
    args.push(startOfTomorrow)
  } else if (view === 'overdue') {
    where.push('due_at IS NOT NULL AND due_at < ? AND completed_at IS NULL')
    args.push(startOfToday)
  } else if (view === 'week') {
    where.push('(due_at IS NULL OR due_at < ?)')
    args.push(startOfNextWeek)
  }

  if (categoryId !== undefined) {
    where.push('category_id = ?')
    args.push(categoryId)
  }
  if (since !== undefined) {
    where.push('updated_at >= ?')
    args.push(since)
  }

  const { rows: taskRows } = await db().execute({
    sql: `SELECT id, category_id, title, notes, priority, due_at, completed_at, position, client_id, created_at, updated_at
          FROM tasks
          WHERE ${where.join(' AND ')}
          ORDER BY
            CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END,
            CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
            due_at ASC,
            priority DESC,
            position ASC,
            created_at ASC`,
    args,
  })

  const taskIds = taskRows.map(r => Number(r.id))
  let subtaskRows: any[] = []
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',')
    const { rows } = await db().execute({
      sql: `SELECT id, task_id, title, completed_at, position, client_id, created_at, updated_at
            FROM subtasks WHERE task_id IN (${placeholders})
            ORDER BY position ASC, created_at ASC`,
      args: taskIds,
    })
    subtaskRows = rows
  }

  const subtasksByTask = new Map<number, any[]>()
  for (const r of subtaskRows) {
    const tid = Number(r.task_id)
    if (!subtasksByTask.has(tid)) subtasksByTask.set(tid, [])
    subtasksByTask.get(tid)!.push({
      id: Number(r.id),
      task_id: tid,
      title: r.title as string,
      completed_at: r.completed_at === null ? null : Number(r.completed_at),
      position: Number(r.position),
      client_id: r.client_id,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    })
  }

  const tasks = taskRows.map(r => ({
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
    subtasks: subtasksByTask.get(Number(r.id)) ?? [],
  }))

  let deleted_ids: { task: number[]; subtask: number[] } = { task: [], subtask: [] }
  if (since !== undefined) {
    const { rows: delRows } = await db().execute({
      sql: `SELECT entity, entity_id FROM deletions
            WHERE user_id = ? AND deleted_at >= ? AND entity IN ('task', 'subtask')`,
      args: [userId, since],
    })
    for (const d of delRows) {
      const e = d.entity as 'task' | 'subtask'
      deleted_ids[e].push(Number(d.entity_id))
    }
  }

  return {
    tasks,
    deleted_ids,
    now: Math.floor(Date.now() / 1000),
  }
})
