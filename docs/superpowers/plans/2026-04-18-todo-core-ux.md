# Todo App — Plan 2 of 4: Core Task UX (online-only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/todos` placeholder into a working, network-dependent task manager — categories/tasks/subtasks CRUD with filter views, a hybrid quick-add bar, mobile + desktop layouts, swipe-to-complete/delete with undo, and auto-hide of completed tasks after local midnight. No offline support yet (that's Plan 3).

**Architecture:** Nuxt 4 server routes (Vercel Node) talk to Turso via `@libsql/client`. Frontend uses plain Vue composables (`useCategories`, `useTasks`, `useCurrentView`, `useUndoSnackbar`) — no Pinia. Optimistic updates are written through in a single in-memory store keyed by server id, fronted by computed projections per filter. Over-the-wire only; IndexedDB + service worker arrive in Plan 3.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Tailwind 3, SCSS, `@libsql/client`.

**Spec:** `docs/superpowers/specs/2026-04-18-todo-app-design.md`

**Predecessor:** Plan 1 (`2026-04-18-todo-backend-skeleton.md`) — shipped 2026-04-18 as merge commit `e5663de`. The auth perimeter, `server/utils/*`, `app/composables/useSession.ts`, `app/utils/apiFetch.ts`, `app/layouts/app.vue`, `app/middleware/auth.ts`, and `app/pages/todos/login.vue` already exist — **do not re-implement**.

**Next plans:**
- Plan 3: Offline + PWA — service worker, manifest, IndexedDB cache, mutation queue, install prompts, proper nonce-based CSP (via `@nuxtjs/security`).
- Plan 4: API keys + external integrations.

**No test framework** is configured (per `CLAUDE.md`). Each task has manual verification; the final end-to-end smoke test is Task 23.

---

## File Structure

**Create:**

Server:
- `server/utils/validation.ts` — small input-validation helpers (string/number/optional-date/enum/uuid)
- `server/utils/datetime.ts` — timezone-aware day/week boundary helpers
- `server/api/categories/index.get.ts`
- `server/api/categories/index.post.ts`
- `server/api/categories/[id].patch.ts`
- `server/api/categories/[id].delete.ts`
- `server/api/tasks/index.get.ts` — list with `view` + `category_id` + `since` params, subtasks inline, deletions delta
- `server/api/tasks/index.post.ts` — create task (optionally with inline subtasks)
- `server/api/tasks/[id].get.ts`
- `server/api/tasks/[id].patch.ts`
- `server/api/tasks/[id].delete.ts`
- `server/api/tasks/[id]/complete.post.ts`
- `server/api/tasks/[id]/uncomplete.post.ts`
- `server/api/tasks/[id]/subtasks.post.ts`
- `server/api/subtasks/[id].patch.ts`
- `server/api/subtasks/[id].delete.ts`
- `server/api/subtasks/[id]/toggle.post.ts`

Frontend utilities:
- `app/utils/clientId.ts` — `randomUUID()` wrapper
- `app/utils/date.ts` — "today", "overdue", "this week" label helpers (browser tz)

Frontend composables:
- `app/composables/useCategories.ts`
- `app/composables/useTasks.ts` — central in-memory store + filter projections
- `app/composables/useCurrentView.ts` — reactive filter state (query-param backed)
- `app/composables/useUndoSnackbar.ts`

Frontend components (`app/components/Todo/*`):
- `CategoryChip.vue` — coloured dot + name
- `PriorityPill.vue` — H/M/L pill
- `CheckCircle.vue` — round checkbox
- `TaskRow.vue` — a row in the list (with swipe)
- `TaskList.vue` — grouped sections
- `QuickAdd.vue` — always-visible top bar
- `QuickAddSheet.vue` — expanded rich-capture sheet
- `FilterChips.vue` — horizontal scrollable chips
- `Sidebar.vue` — desktop-only left nav
- `SubtaskRow.vue`
- `SubtaskList.vue`
- `TaskDetail.vue` — shared by mobile full-screen overlay + desktop right pane
- `Snackbar.vue` — undo snackbar

Frontend pages:
- `app/pages/todos/settings/index.vue` — settings hub
- `app/pages/todos/settings/categories.vue` — category CRUD

**Modify:**
- `app/pages/todos/index.vue` — replace the Plan 1 placeholder with the real home view

---

## Prerequisites (one-time, before Task 1)

- [ ] **Create a fresh worktree for this plan.**

```bash
git worktree add ~/.config/superpowers/worktrees/alola/todos-core-ux -b feat/todos-core-ux
cd ~/.config/superpowers/worktrees/alola/todos-core-ux
npm install
cp /home/graemel/.config/superpowers/worktrees/alola/todos-backend-skeleton/.env .env 2>/dev/null || cp .env.example .env
# If .env was copied from the old worktree, it already has dev creds. Otherwise, paste the dev creds into .env.
```

- [ ] **Verify baseline:** `npm run dev`, browse to `http://localhost:3000/todos/login`, sign in with dev creds, land on the placeholder. `Ctrl+C` the dev server once confirmed.

---

### Task 1: Shared server helpers — validation + datetime

**Files:**
- Create: `server/utils/validation.ts`
- Create: `server/utils/datetime.ts`

- [ ] **Step 1: Write `server/utils/validation.ts`**

```ts
// server/utils/validation.ts — small helpers for parsing untrusted bodies.
import { throwApiError } from './errors'

export function requireString(v: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
  if (typeof v !== 'string') throwApiError('validation_failed', `${field} must be a string`)
  const s = (v as string).trim()
  if (opts.min !== undefined && s.length < opts.min) throwApiError('validation_failed', `${field} is too short`)
  if (opts.max !== undefined && s.length > opts.max) throwApiError('validation_failed', `${field} is too long`)
  return s
}

export function optionalString(v: unknown, field: string, opts: { max?: number } = {}): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return requireString(v, field, opts)
}

export function optionalInt(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throwApiError('validation_failed', `${field} must be an integer`)
  if (opts.min !== undefined && n < opts.min) throwApiError('validation_failed', `${field} is too small`)
  if (opts.max !== undefined && n > opts.max) throwApiError('validation_failed', `${field} is too large`)
  return n
}

export function requireInt(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = optionalInt(v, field, opts)
  if (n === undefined) throwApiError('validation_failed', `${field} is required`)
  return n!
}

export function requireEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throwApiError('validation_failed', `${field} must be one of ${allowed.join(', ')}`)
  }
  return v as T
}

export function optionalEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return requireEnum(v, field, allowed)
}

export function requireHexColor(v: unknown, field: string): string {
  const s = requireString(v, field)
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throwApiError('validation_failed', `${field} must be a hex colour like #4a7c59`)
  return s.toLowerCase()
}
```

- [ ] **Step 2: Write `server/utils/datetime.ts`**

```ts
// server/utils/datetime.ts — timezone-aware day boundaries in unix seconds.
// All *InTz helpers take an IANA tz string like 'Europe/London'.

/** Unix seconds at midnight today in `tz`. */
export function startOfTodayInTz(tz: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const pick = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const hour = pick('hour') % 24  // formatToParts may emit '24' at midnight in some runtimes
  const msIntoDay = ((hour * 60 + pick('minute')) * 60 + pick('second')) * 1000 + now.getMilliseconds()
  return Math.floor((now.getTime() - msIntoDay) / 1000)
}

/** Unix seconds at midnight N days after today in `tz`. */
export function startOfDayPlusInTz(tz: string, daysOffset: number, now: Date = new Date()): number {
  return startOfTodayInTz(tz, now) + daysOffset * 86400
}

/** Unix seconds at midnight at the start of next calendar week (Monday), in `tz`. */
export function startOfNextWeekInTz(tz: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' })
  const weekday = fmt.format(now)  // 'Mon' | 'Tue' | ...
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const daysUntilMon = (7 - order.indexOf(weekday)) % 7 || 7
  return startOfDayPlusInTz(tz, daysUntilMon, now)
}
```

- [ ] **Step 3: Commit**

```bash
git add server/utils/validation.ts server/utils/datetime.ts
git commit -m "feat(todos): add validation and datetime server helpers"
```

---

### Task 2: Categories API — list + create

**Files:**
- Create: `server/api/categories/index.get.ts`
- Create: `server/api/categories/index.post.ts`

- [ ] **Step 1: Write `server/api/categories/index.get.ts`**

```ts
// server/api/categories/index.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { rows } = await db().execute({
    sql: `SELECT id, name, color, position, created_at, updated_at
          FROM categories WHERE user_id = ?
          ORDER BY position ASC, created_at ASC`,
    args: [userId],
  })
  return {
    categories: rows.map(r => ({
      id: Number(r.id),
      name: r.name as string,
      color: r.color as string,
      position: Number(r.position),
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    })),
  }
})
```

- [ ] **Step 2: Write `server/api/categories/index.post.ts`**

```ts
// server/api/categories/index.post.ts
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { requireString, optionalInt, requireHexColor } from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const body = await readBody(event)
  const name = requireString(body?.name, 'name', { min: 1, max: 60 })
  const color = requireHexColor(body?.color, 'color')
  const position = optionalInt(body?.position, 'position', { min: 0 }) ?? 0

  try {
    const { lastInsertRowid } = await db().execute({
      sql: 'INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)',
      args: [userId, name, color, position],
    })
    const id = Number(lastInsertRowid)
    setResponseStatus(event, 201)
    return {
      category: {
        id, name, color, position,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      },
    }
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throwApiError('validation_failed', `a category named "${name}" already exists`)
    }
    throw e
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add server/api/categories/index.get.ts server/api/categories/index.post.ts
git commit -m "feat(todos): GET and POST /api/categories"
```

---

### Task 3: Categories API — patch + delete

**Files:**
- Create: `server/api/categories/[id].patch.ts`
- Create: `server/api/categories/[id].delete.ts`

- [ ] **Step 1: Write `server/api/categories/[id].patch.ts`**

```ts
// server/api/categories/[id].patch.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { optionalString, optionalInt, requireHexColor } from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const body = await readBody(event)
  const name = optionalString(body?.name, 'name', { max: 60 })
  const color = body?.color !== undefined && body?.color !== null ? requireHexColor(body.color, 'color') : undefined
  const position = optionalInt(body?.position, 'position', { min: 0 })

  const sets: string[] = []
  const args: unknown[] = []
  if (name !== undefined)     { sets.push('name = ?');     args.push(name) }
  if (color !== undefined)    { sets.push('color = ?');    args.push(color) }
  if (position !== undefined) { sets.push('position = ?'); args.push(position) }
  if (sets.length === 0) throwApiError('validation_failed', 'no fields to update')

  sets.push('updated_at = ?')
  args.push(Math.floor(Date.now() / 1000))

  args.push(id, userId)
  try {
    const res = await db().execute({
      sql: `UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING id, name, color, position, created_at, updated_at`,
      args,
    })
    if (res.rows.length === 0) throwApiError('not_found', 'category not found')
    const r = res.rows[0]
    return {
      category: {
        id: Number(r.id),
        name: r.name as string,
        color: r.color as string,
        position: Number(r.position),
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at),
      },
    }
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throwApiError('validation_failed', `a category with that name already exists`)
    }
    throw e
  }
})
```

- [ ] **Step 2: Write `server/api/categories/[id].delete.ts`**

```ts
// server/api/categories/[id].delete.ts
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

  const now = Math.floor(Date.now() / 1000)
  // Bump child tasks' updated_at before deleting the category so delta-sync sees the SET NULL effect.
  await db().batch([
    { sql: 'UPDATE tasks SET updated_at = ? WHERE user_id = ? AND category_id = ?', args: [now, userId, id] },
    { sql: 'DELETE FROM categories WHERE id = ? AND user_id = ?', args: [id, userId] },
  ])
  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 3: Commit**

```bash
git add server/api/categories/[id].patch.ts server/api/categories/[id].delete.ts
git commit -m "feat(todos): PATCH and DELETE /api/categories/:id"
```

---

### Task 4: Tasks API — GET list with view, since, inline subtasks

**Files:**
- Create: `server/api/tasks/index.get.ts`

This is the hot path: the frontend's "initial load" and "filtered view" both come from here.

- [ ] **Step 1: Write `server/api/tasks/index.get.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add server/api/tasks/index.get.ts
git commit -m "feat(todos): GET /api/tasks with views, category filter, delta since"
```

---

### Task 5: Tasks API — create + get one

**Files:**
- Create: `server/api/tasks/index.post.ts`
- Create: `server/api/tasks/[id].get.ts`

- [ ] **Step 1: Write `server/api/tasks/index.post.ts`**

```ts
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
```

- [ ] **Step 2: Write `server/api/tasks/[id].get.ts`**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add server/api/tasks/index.post.ts server/api/tasks/[id].get.ts
git commit -m "feat(todos): POST /api/tasks (with inline subtasks) and GET /api/tasks/:id"
```

---

### Task 6: Tasks API — patch + delete

**Files:**
- Create: `server/api/tasks/[id].patch.ts`
- Create: `server/api/tasks/[id].delete.ts`

- [ ] **Step 1: Write `server/api/tasks/[id].patch.ts`**

```ts
// server/api/tasks/[id].patch.ts
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
```

- [ ] **Step 2: Write `server/api/tasks/[id].delete.ts`**

```ts
// server/api/tasks/[id].delete.ts
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
```

- [ ] **Step 3: Commit**

```bash
git add server/api/tasks/[id].patch.ts server/api/tasks/[id].delete.ts
git commit -m "feat(todos): PATCH and DELETE /api/tasks/:id with deletions tombstones"
```

---

### Task 7: Tasks API — complete + uncomplete

**Files:**
- Create: `server/api/tasks/[id]/complete.post.ts`
- Create: `server/api/tasks/[id]/uncomplete.post.ts`

- [ ] **Step 1: Write `server/api/tasks/[id]/complete.post.ts`**

```ts
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
```

- [ ] **Step 2: Write `server/api/tasks/[id]/uncomplete.post.ts`**

```ts
// server/api/tasks/[id]/uncomplete.post.ts
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
    sql: `UPDATE tasks SET completed_at = NULL, updated_at = ?
          WHERE id = ? AND user_id = ?
          RETURNING id, completed_at, updated_at`,
    args: [now, id, userId],
  })
  if (res.rows.length === 0) throwApiError('not_found', 'task not found')
  const r = res.rows[0]
  return {
    id: Number(r.id),
    completed_at: r.completed_at === null ? null : Number(r.completed_at),
    updated_at: Number(r.updated_at),
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add server/api/tasks/[id]/complete.post.ts server/api/tasks/[id]/uncomplete.post.ts
git commit -m "feat(todos): POST /api/tasks/:id/complete and /uncomplete"
```

---

### Task 8: Subtasks API — create, patch, delete, toggle

**Files:**
- Create: `server/api/tasks/[id]/subtasks.post.ts`
- Create: `server/api/subtasks/[id].patch.ts`
- Create: `server/api/subtasks/[id].delete.ts`
- Create: `server/api/subtasks/[id]/toggle.post.ts`

- [ ] **Step 1: Write `server/api/tasks/[id]/subtasks.post.ts`**

Important: this MUST live under `[id]/` (not a separate `[taskId]/` directory). Nitro's file router does not support two different dynamic-param names as sibling directories at the same level — it silently drops one set of routes. All `server/api/tasks/[id]/*` handlers share a single param name (`id`).

```ts
// server/api/tasks/[id]/subtasks.post.ts
import { defineEventHandler, readBody, getRouterParam, setResponseStatus } from 'h3'
import { db } from '../../../utils/db'
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

  const { lastInsertRowid } = await db().execute({
    sql: 'INSERT INTO subtasks (task_id, title, position, client_id) VALUES (?, ?, ?, ?)',
    args: [taskId, title, position, clientId],
  })
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
```

- [ ] **Step 2: Write `server/api/subtasks/[id].patch.ts`**

```ts
// server/api/subtasks/[id].patch.ts
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
```

- [ ] **Step 3: Write `server/api/subtasks/[id].delete.ts`**

```ts
// server/api/subtasks/[id].delete.ts
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
```

- [ ] **Step 4: Write `server/api/subtasks/[id]/toggle.post.ts`**

```ts
// server/api/subtasks/[id]/toggle.post.ts — flip completed_at.
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
```

- [ ] **Step 5: Commit**

```bash
git add server/api/tasks/[id]/subtasks.post.ts server/api/subtasks/[id].patch.ts server/api/subtasks/[id].delete.ts server/api/subtasks/[id]/toggle.post.ts
git commit -m "feat(todos): subtasks CRUD + toggle endpoints"
```

---

### Task 9: Client utilities — clientId and date labels

**Files:**
- Create: `app/utils/clientId.ts`
- Create: `app/utils/date.ts`

- [ ] **Step 1: Write `app/utils/clientId.ts`**

```ts
// app/utils/clientId.ts — UUID v4 generator used for optimistic creates.
export function clientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (unlikely in modern browsers).
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
```

- [ ] **Step 2: Write `app/utils/date.ts`**

```ts
// app/utils/date.ts — client-side date helpers (browser local tz).
// Dates are stored as unix seconds. Due dates are date-only; we treat due_at as
// the START OF THE DUE DAY in user's tz (backend decides; client just displays).

export function startOfToday(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

export function startOfTomorrow(now = new Date()): number {
  return startOfToday(now) + 86400
}

export function startOfNextWeek(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()  // Sun=0..Sat=6
  const daysUntilMon = (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntilMon)
  return Math.floor(d.getTime() / 1000)
}

export function formatDueLabel(dueAt: number | null, now = new Date()): {
  label: string
  tone: 'overdue' | 'today' | 'soon' | 'future' | 'none'
} {
  if (dueAt === null) return { label: '', tone: 'none' }
  const today = startOfToday(now)
  const tomorrow = today + 86400
  const sevenDays = today + 7 * 86400

  if (dueAt < today) {
    const daysOverdue = Math.floor((today - dueAt) / 86400)
    return {
      label: daysOverdue === 1 ? 'Yesterday' : `${daysOverdue} days overdue`,
      tone: 'overdue',
    }
  }
  if (dueAt < tomorrow) return { label: 'Today', tone: 'today' }
  if (dueAt < tomorrow + 86400) return { label: 'Tomorrow', tone: 'soon' }

  const d = new Date(dueAt * 1000)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  if (dueAt < sevenDays) return { label: `${weekday} ${day} ${month}`, tone: 'soon' }
  return { label: `${weekday} ${day} ${month}`, tone: 'future' }
}

/** Returns a due_at unix seconds value for "today" (start of day local tz). */
export function todayAsDueAt(now = new Date()): number {
  return startOfToday(now)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/utils/clientId.ts app/utils/date.ts
git commit -m "feat(todos): add clientId and date label client utilities"
```

---

### Task 10: Categories composable

**Files:**
- Create: `app/composables/useCategories.ts`

- [ ] **Step 1: Write `app/composables/useCategories.ts`**

```ts
// app/composables/useCategories.ts — fetch and CRUD categories.
import { ref, computed } from 'vue'
import { apiFetch } from '~/utils/apiFetch'

export interface Category {
  id: number
  name: string
  color: string
  position: number
  created_at: number
  updated_at: number
}

const categories = ref<Category[]>([])
const loaded = ref(false)
const loading = ref(false)

export function useCategories() {
  const byId = computed(() => {
    const m = new Map<number, Category>()
    for (const c of categories.value) m.set(c.id, c)
    return m
  })

  async function refresh() {
    loading.value = true
    try {
      const res = await apiFetch<{ categories: Category[] }>('/api/categories')
      categories.value = res.categories.slice().sort((a, b) => a.position - b.position || a.created_at - b.created_at)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function create(input: { name: string; color: string; position?: number }): Promise<Category> {
    const res = await apiFetch<{ category: Category }>('/api/categories', {
      method: 'POST',
      body: input,
    })
    categories.value = [...categories.value, res.category].sort((a, b) => a.position - b.position || a.created_at - b.created_at)
    return res.category
  }

  async function update(id: number, patch: Partial<Pick<Category, 'name' | 'color' | 'position'>>): Promise<Category> {
    const res = await apiFetch<{ category: Category }>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: patch,
    })
    categories.value = categories.value.map(c => (c.id === id ? res.category : c))
      .sort((a, b) => a.position - b.position || a.created_at - b.created_at)
    return res.category
  }

  async function remove(id: number): Promise<void> {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' })
    categories.value = categories.value.filter(c => c.id !== id)
  }

  return { categories, loaded, loading, byId, refresh, create, update, remove }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useCategories.ts
git commit -m "feat(todos): useCategories composable"
```

---

### Task 11: Tasks composable + current-view state

**Files:**
- Create: `app/composables/useTasks.ts`
- Create: `app/composables/useCurrentView.ts`

- [ ] **Step 1: Write `app/composables/useTasks.ts`**

```ts
// app/composables/useTasks.ts — central in-memory task store + CRUD helpers.
// Online-only in Plan 2. Plan 3 adds IndexedDB cache + offline queue on top.
import { ref, computed, type ComputedRef } from 'vue'
import { apiFetch } from '~/utils/apiFetch'
import { clientId as makeClientId } from '~/utils/clientId'
import { startOfToday, startOfTomorrow, startOfNextWeek } from '~/utils/date'

export interface Subtask {
  id: number
  task_id: number
  title: string
  completed_at: number | null
  position: number
  client_id: string | null
  created_at: number
  updated_at: number
}

export interface Task {
  id: number
  category_id: number | null
  title: string
  notes: string | null
  priority: number
  due_at: number | null
  completed_at: number | null
  position: number
  client_id: string | null
  created_at: number
  updated_at: number
  subtasks: Subtask[]
}

export type View = 'today' | 'overdue' | 'week' | 'all'

const tasks = ref<Task[]>([])
const loaded = ref(false)
const loading = ref(false)
const lastSyncAt = ref<number>(0)

function sortTasks(arr: Task[]): Task[] {
  return arr.slice().sort((a, b) => {
    const ac = a.completed_at === null ? 0 : 1
    const bc = b.completed_at === null ? 0 : 1
    if (ac !== bc) return ac - bc
    if (a.due_at !== b.due_at) {
      if (a.due_at === null) return 1
      if (b.due_at === null) return -1
      return a.due_at - b.due_at
    }
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.position !== b.position) return a.position - b.position
    return a.created_at - b.created_at
  })
}

function upsert(t: Task) {
  const i = tasks.value.findIndex(x => x.id === t.id)
  if (i === -1) tasks.value = sortTasks([...tasks.value, t])
  else {
    const copy = tasks.value.slice()
    copy[i] = t
    tasks.value = sortTasks(copy)
  }
}

function remove(id: number) {
  tasks.value = tasks.value.filter(t => t.id !== id)
}

export function useTasks() {
  async function refresh(view: View = 'all', categoryId: number | null = null): Promise<void> {
    loading.value = true
    try {
      const params = new URLSearchParams({ view })
      if (categoryId !== null) params.set('category_id', String(categoryId))
      const res = await apiFetch<{ tasks: Task[]; deleted_ids: { task: number[]; subtask: number[] }; now: number }>(
        `/api/tasks?${params.toString()}`,
      )
      tasks.value = sortTasks(res.tasks)
      lastSyncAt.value = res.now
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function create(input: {
    title: string
    notes?: string
    category_id?: number | null
    priority?: number
    due_at?: number | null
    subtasks?: { title: string; position?: number }[]
  }): Promise<Task> {
    const body = {
      client_id: makeClientId(),
      title: input.title,
      notes: input.notes,
      category_id: input.category_id ?? undefined,
      priority: input.priority ?? 2,
      due_at: input.due_at ?? undefined,
      subtasks: (input.subtasks ?? []).map((s, i) => ({
        client_id: makeClientId(),
        title: s.title,
        position: s.position ?? i,
      })),
    }
    const res = await apiFetch<{ task: Task }>('/api/tasks', { method: 'POST', body })
    upsert(res.task)
    return res.task
  }

  async function update(id: number, patch: Partial<Pick<Task, 'title' | 'notes' | 'category_id' | 'priority' | 'due_at' | 'position'>>): Promise<Task> {
    const res = await apiFetch<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: patch })
    upsert(res.task)
    return res.task
  }

  async function destroy(id: number): Promise<void> {
    // Optimistic: remove locally immediately.
    const prev = tasks.value.find(t => t.id === id) ?? null
    remove(id)
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch (e) {
      if (prev) upsert(prev)
      throw e
    }
  }

  async function complete(id: number): Promise<void> {
    const res = await apiFetch<{ id: number; completed_at: number; updated_at: number }>(
      `/api/tasks/${id}/complete`,
      { method: 'POST' },
    )
    const t = tasks.value.find(x => x.id === id)
    if (t) upsert({ ...t, completed_at: res.completed_at, updated_at: res.updated_at })
  }

  async function uncomplete(id: number): Promise<void> {
    const res = await apiFetch<{ id: number; completed_at: number | null; updated_at: number }>(
      `/api/tasks/${id}/uncomplete`,
      { method: 'POST' },
    )
    const t = tasks.value.find(x => x.id === id)
    if (t) upsert({ ...t, completed_at: res.completed_at, updated_at: res.updated_at })
  }

  async function addSubtask(taskId: number, title: string, position = 0): Promise<Subtask> {
    const body = { client_id: makeClientId(), title, position }
    const res = await apiFetch<{ subtask: Subtask }>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body })
    const t = tasks.value.find(x => x.id === taskId)
    if (t) {
      const next = { ...t, subtasks: [...t.subtasks, res.subtask].sort((a, b) => a.position - b.position || a.created_at - b.created_at) }
      upsert(next)
    }
    return res.subtask
  }

  async function updateSubtask(id: number, patch: Partial<Pick<Subtask, 'title' | 'position' | 'completed_at'>>): Promise<void> {
    const res = await apiFetch<{ subtask: Subtask }>(`/api/subtasks/${id}`, { method: 'PATCH', body: patch })
    const t = tasks.value.find(x => x.id === res.subtask.task_id)
    if (t) {
      const next = {
        ...t,
        subtasks: t.subtasks.map(s => (s.id === id ? res.subtask : s))
          .sort((a, b) => a.position - b.position || a.created_at - b.created_at),
      }
      upsert(next)
    }
  }

  async function deleteSubtask(id: number): Promise<void> {
    // Find parent for optimistic rollback.
    let parent: Task | null = null
    for (const t of tasks.value) if (t.subtasks.some(s => s.id === id)) { parent = t; break }
    if (!parent) return
    const prev = parent
    const next = { ...parent, subtasks: parent.subtasks.filter(s => s.id !== id) }
    upsert(next)
    try {
      await apiFetch(`/api/subtasks/${id}`, { method: 'DELETE' })
    } catch (e) {
      upsert(prev)
      throw e
    }
  }

  async function toggleSubtask(id: number): Promise<void> {
    const res = await apiFetch<{ subtask: Subtask }>(`/api/subtasks/${id}/toggle`, { method: 'POST' })
    const t = tasks.value.find(x => x.id === res.subtask.task_id)
    if (t) {
      const next = { ...t, subtasks: t.subtasks.map(s => (s.id === id ? res.subtask : s)) }
      upsert(next)
    }
  }

  // Client-side projections for the current view (server sends superset when view='all').
  function projection(view: View, categoryId: number | null): ComputedRef<Task[]> {
    return computed(() => {
      const today = startOfToday()
      const tomorrow = startOfTomorrow()
      const nextWeek = startOfNextWeek()
      return tasks.value.filter(t => {
        if (categoryId !== null && t.category_id !== categoryId) return false
        // Auto-hide: completed before today → out.
        if (t.completed_at !== null && t.completed_at < today) return false
        if (view === 'today') {
          return t.due_at === null || t.due_at < tomorrow
        }
        if (view === 'overdue') {
          return t.completed_at === null && t.due_at !== null && t.due_at < today
        }
        if (view === 'week') {
          return t.due_at === null || t.due_at < nextWeek
        }
        return true
      })
    })
  }

  return {
    tasks,
    loaded,
    loading,
    lastSyncAt,
    refresh,
    create,
    update,
    destroy,
    complete,
    uncomplete,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    toggleSubtask,
    projection,
  }
}
```

- [ ] **Step 2: Write `app/composables/useCurrentView.ts`**

```ts
// app/composables/useCurrentView.ts — reactive filter state mapped to URL query params.
import { computed } from 'vue'
import { useRoute, useRouter } from '#app'
import type { View } from '~/composables/useTasks'

const VALID_VIEWS: View[] = ['today', 'overdue', 'week', 'all']

export function useCurrentView() {
  const route = useRoute()
  const router = useRouter()

  const view = computed<View>({
    get() {
      const v = route.query.view
      if (typeof v === 'string' && (VALID_VIEWS as string[]).includes(v)) return v as View
      return 'today'
    },
    set(v) {
      const q = { ...route.query }
      if (v === 'today') delete q.view
      else q.view = v
      router.replace({ query: q })
    },
  })

  const categoryId = computed<number | null>({
    get() {
      const c = route.query.category
      if (typeof c === 'string') {
        const n = Number(c)
        if (Number.isFinite(n)) return n
      }
      return null
    },
    set(v) {
      const q = { ...route.query }
      if (v === null) delete q.category
      else q.category = String(v)
      router.replace({ query: q })
    },
  })

  const selectedTaskId = computed<number | null>({
    get() {
      const t = route.query.task
      if (typeof t === 'string') {
        const n = Number(t)
        if (Number.isFinite(n)) return n
      }
      return null
    },
    set(v) {
      const q = { ...route.query }
      if (v === null) delete q.task
      else q.task = String(v)
      router.replace({ query: q })
    },
  })

  return { view, categoryId, selectedTaskId }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTasks.ts app/composables/useCurrentView.ts
git commit -m "feat(todos): useTasks store + useCurrentView URL-backed filter"
```

---

### Task 12: Undo snackbar composable

**Files:**
- Create: `app/composables/useUndoSnackbar.ts`

- [ ] **Step 1: Write `app/composables/useUndoSnackbar.ts`**

```ts
// app/composables/useUndoSnackbar.ts — transient snackbar with an undo callback.
import { ref } from 'vue'

interface Snack {
  id: number
  message: string
  onUndo?: () => void | Promise<void>
  expiresAt: number
}

const active = ref<Snack | null>(null)
let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null

export function useUndoSnackbar() {
  function show(message: string, onUndo?: () => void | Promise<void>, durationMs = 6000) {
    if (timer) clearTimeout(timer)
    const id = nextId++
    active.value = { id, message, onUndo, expiresAt: Date.now() + durationMs }
    timer = setTimeout(() => {
      if (active.value?.id === id) active.value = null
    }, durationMs)
  }

  async function undo() {
    const current = active.value
    if (!current?.onUndo) return
    active.value = null
    if (timer) { clearTimeout(timer); timer = null }
    try { await current.onUndo() } catch { /* swallow — user retries */ }
  }

  function dismiss() {
    active.value = null
    if (timer) { clearTimeout(timer); timer = null }
  }

  return { active, show, undo, dismiss }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useUndoSnackbar.ts
git commit -m "feat(todos): useUndoSnackbar composable"
```

---

### Task 13: Small presentational components

**Files:**
- Create: `app/components/Todo/CategoryChip.vue`
- Create: `app/components/Todo/PriorityPill.vue`
- Create: `app/components/Todo/CheckCircle.vue`

- [ ] **Step 1: Write `app/components/Todo/CategoryChip.vue`**

```vue
<script setup lang="ts">
defineProps<{
  color: string
  name: string
  dense?: boolean
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap" :class="dense ? 'text-xs' : 'text-sm'">
    <span class="inline-block rounded-full" :class="dense ? 'w-1.5 h-1.5' : 'w-2 h-2'" :style="{ background: color }" />
    <span class="text-ink-muted">{{ name }}</span>
  </span>
</template>
```

- [ ] **Step 2: Write `app/components/Todo/PriorityPill.vue`**

```vue
<script setup lang="ts">
defineProps<{ priority: number }>()
const labels: Record<number, string> = { 1: 'LOW', 2: 'MED', 3: 'HIGH' }
</script>

<template>
  <span
    class="flex-shrink-0 rounded text-[0.66rem] font-bold tracking-wider"
    :class="[
      'px-1.5 py-px',
      priority === 3 && 'bg-accent/20 text-accent-light',
      priority === 2 && 'bg-ink-muted/15 text-ink-muted',
      priority === 1 && 'bg-transparent text-ink-faint',
    ]"
  >{{ labels[priority] ?? '—' }}</span>
</template>
```

- [ ] **Step 3: Write `app/components/Todo/CheckCircle.vue`**

```vue
<script setup lang="ts">
defineProps<{
  checked: boolean
  highPriority?: boolean
  size?: 'sm' | 'md'
}>()
defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <button
    type="button"
    class="relative flex-shrink-0 rounded-full transition-colors"
    :class="[
      size === 'sm' ? 'w-[18px] h-[18px] border-[1.5px]' : 'w-[22px] h-[22px] border-[1.5px]',
      checked ? 'bg-accent border-accent' : (highPriority ? 'border-accent' : 'border-ink-faint'),
    ]"
    :aria-checked="checked"
    :aria-label="checked ? 'Mark incomplete' : 'Mark complete'"
    role="checkbox"
    @click.stop="$emit('toggle')"
  >
    <svg v-if="checked" viewBox="0 0 24 24" class="absolute inset-0 m-auto" :class="size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'">
      <path d="M5 12l5 5L20 7" fill="none" stroke="#141210" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
```

- [ ] **Step 4: Commit**

```bash
git add app/components/Todo/CategoryChip.vue app/components/Todo/PriorityPill.vue app/components/Todo/CheckCircle.vue
git commit -m "feat(todos): CategoryChip, PriorityPill, CheckCircle components"
```

---

### Task 14: TaskRow component (with swipe)

**Files:**
- Create: `app/components/Todo/TaskRow.vue`

- [ ] **Step 1: Write `app/components/Todo/TaskRow.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'
import { formatDueLabel } from '~/utils/date'
import CheckCircle from '~/components/Todo/CheckCircle.vue'
import PriorityPill from '~/components/Todo/PriorityPill.vue'
import CategoryChip from '~/components/Todo/CategoryChip.vue'

const props = defineProps<{
  task: Task
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'open'): void
  (e: 'swipe-complete'): void
  (e: 'swipe-delete'): void
}>()

const { byId } = useCategories()
const category = computed(() => props.task.category_id ? byId.value.get(props.task.category_id) : null)
const due = computed(() => formatDueLabel(props.task.due_at))
const subtaskProgress = computed(() => {
  const total = props.task.subtasks.length
  if (total === 0) return null
  const done = props.task.subtasks.filter(s => s.completed_at !== null).length
  return `${done} of ${total}`
})
const isHigh = computed(() => props.task.priority === 3)
const done = computed(() => props.task.completed_at !== null)

// --- Swipe handling (touch only; desktop uses click) ---
const dx = ref(0)
const swiping = ref(false)
const SWIPE_THRESHOLD = 80
let startX = 0
let startY = 0

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  startX = t.clientX
  startY = t.clientY
  swiping.value = true
}
function onTouchMove(e: TouchEvent) {
  if (!swiping.value) return
  const t = e.touches[0]
  const dxNow = t.clientX - startX
  const dyNow = t.clientY - startY
  // Ignore mostly-vertical drags (scroll intent).
  if (Math.abs(dyNow) > Math.abs(dxNow)) { swiping.value = false; dx.value = 0; return }
  dx.value = dxNow
}
function onTouchEnd() {
  if (!swiping.value) return
  swiping.value = false
  if (dx.value >= SWIPE_THRESHOLD) emit('swipe-complete')
  else if (dx.value <= -SWIPE_THRESHOLD) emit('swipe-delete')
  dx.value = 0
}
</script>

<template>
  <div class="relative overflow-hidden rounded-xl" :class="{ 'bg-accent/8': selected }">
    <!-- Swipe reveal backgrounds -->
    <div
      class="absolute inset-y-0 left-0 w-20 flex items-center justify-center text-white bg-emerald-700/90"
      :style="{ opacity: dx > 8 ? 1 : 0 }"
    >
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div
      class="absolute inset-y-0 right-0 w-20 flex items-center justify-center text-white bg-red-800/90"
      :style="{ opacity: dx < -8 ? 1 : 0 }"
    >
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
    </div>

    <!-- Foreground row -->
    <div
      class="relative bg-surface flex items-start gap-3 px-3 py-2.5 cursor-pointer"
      :class="[done && 'opacity-60']"
      :style="{ transform: `translateX(${dx}px)`, transition: swiping ? 'none' : 'transform 0.2s ease-out' }"
      @click="emit('open')"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <CheckCircle :checked="done" :high-priority="isHigh" @toggle="emit('toggle')" class="mt-[2px]" />
      <div class="flex-1 min-w-0">
        <div class="text-[0.95rem] leading-snug" :class="[done && 'line-through text-ink-faint', isHigh && !done && 'font-semibold', !done && !isHigh && 'font-medium']">
          {{ task.title }}
        </div>
        <div class="flex items-center gap-1.5 mt-1 text-[0.73rem] text-ink-muted flex-wrap">
          <CategoryChip v-if="category" :color="category.color" :name="category.name" dense />
          <template v-if="category && (due.label || subtaskProgress)"><span class="text-ink-faint">·</span></template>
          <span
            v-if="due.label"
            :class="{
              'text-[#c7513a] font-semibold': due.tone === 'overdue',
              'text-accent-light font-semibold': due.tone === 'today',
            }"
          >{{ due.label }}</span>
          <template v-if="due.label && subtaskProgress"><span class="text-ink-faint">·</span></template>
          <span v-if="subtaskProgress">{{ subtaskProgress }}</span>
        </div>
      </div>
      <PriorityPill :priority="task.priority" class="mt-[3px]" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Todo/TaskRow.vue
git commit -m "feat(todos): TaskRow with touch swipe and mock backgrounds"
```

---

### Task 15: TaskList with grouped sections

**Files:**
- Create: `app/components/Todo/TaskList.vue`

- [ ] **Step 1: Write `app/components/Todo/TaskList.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Task, View } from '~/composables/useTasks'
import { startOfToday, startOfTomorrow } from '~/utils/date'
import TaskRow from '~/components/Todo/TaskRow.vue'

const props = defineProps<{
  tasks: Task[]
  view: View
  selectedTaskId: number | null
}>()

const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'open', id: number): void
  (e: 'swipe-complete', id: number): void
  (e: 'swipe-delete', id: number): void
}>()

interface Section { label: string; tone?: 'overdue' | 'default'; tasks: Task[] }

const sections = computed<Section[]>(() => {
  const today = startOfToday()
  const tomorrow = startOfTomorrow()
  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const upcoming: Task[] = []
  const completedToday: Task[] = []

  for (const t of props.tasks) {
    if (t.completed_at !== null && t.completed_at >= today) { completedToday.push(t); continue }
    if (t.completed_at !== null) continue  // should already be filtered out; belt & braces
    if (t.due_at !== null && t.due_at < today) { overdue.push(t); continue }
    if (t.due_at !== null && t.due_at < tomorrow) { todayTasks.push(t); continue }
    upcoming.push(t)
  }

  const out: Section[] = []
  if (overdue.length)        out.push({ label: `Overdue · ${overdue.length}`, tone: 'overdue', tasks: overdue })
  if (todayTasks.length)     out.push({ label: `Today · ${todayTasks.length}`, tasks: todayTasks })
  if (upcoming.length && props.view !== 'today' && props.view !== 'overdue') {
    out.push({ label: `Upcoming · ${upcoming.length}`, tasks: upcoming })
  }
  if (upcoming.length && props.view === 'today') {
    // If the user only asks for today but we also have undated, show them under a catch-all.
    out.push({ label: `Later · ${upcoming.length}`, tasks: upcoming })
  }
  if (completedToday.length) out.push({ label: `Completed today · ${completedToday.length}`, tasks: completedToday })
  return out
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <template v-for="s in sections" :key="s.label">
      <div
        class="px-2 pt-3 pb-1 text-[0.68rem] uppercase tracking-[0.1em] font-semibold"
        :class="s.tone === 'overdue' ? 'text-[#c7513a]' : 'text-ink-faint'"
      >{{ s.label }}</div>
      <TaskRow
        v-for="task in s.tasks"
        :key="task.id"
        :task="task"
        :selected="task.id === selectedTaskId"
        @toggle="emit('toggle', task.id)"
        @open="emit('open', task.id)"
        @swipe-complete="emit('swipe-complete', task.id)"
        @swipe-delete="emit('swipe-delete', task.id)"
      />
    </template>

    <div v-if="sections.length === 0" class="py-14 text-center text-ink-muted">
      <p class="font-display text-lg text-ink">Nothing here.</p>
      <p class="mt-1 text-sm">Add a task above to get started.</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Todo/TaskList.vue
git commit -m "feat(todos): TaskList with grouped sections"
```

---

### Task 16: FilterChips + Sidebar

**Files:**
- Create: `app/components/Todo/FilterChips.vue`
- Create: `app/components/Todo/Sidebar.vue`

- [ ] **Step 1: Write `app/components/Todo/FilterChips.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { View } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'

const props = defineProps<{
  view: View
  categoryId: number | null
}>()
const emit = defineEmits<{
  (e: 'update:view', v: View): void
  (e: 'update:categoryId', id: number | null): void
}>()

const { categories } = useCategories()

function selectView(v: View) {
  emit('update:categoryId', null)
  emit('update:view', v)
}
function selectCategory(id: number) {
  emit('update:view', 'all')
  emit('update:categoryId', id)
}

const anyCategory = computed(() => props.categoryId !== null)
</script>

<template>
  <div class="flex gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar">
    <button type="button" class="chip" :class="{ 'chip-active': view === 'today' && !anyCategory }" @click="selectView('today')">Today</button>
    <button type="button" class="chip" :class="{ 'chip-active': view === 'all' && !anyCategory }" @click="selectView('all')">All</button>
    <button type="button" class="chip" :class="{ 'chip-active': view === 'week' && !anyCategory }" @click="selectView('week')">This week</button>
    <button
      v-for="c in categories"
      :key="c.id"
      type="button"
      class="chip"
      :class="{ 'chip-active': categoryId === c.id }"
      @click="selectCategory(c.id)"
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full" :style="{ background: c.color }" />
      {{ c.name }}
    </button>
  </div>
</template>

<style scoped>
.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
  color: theme(colors.ink.muted);
  border: 1px solid theme(colors.ink.faint / 0.2);
  background: transparent;
  white-space: nowrap;
}
.chip-active {
  background: theme(colors.accent.DEFAULT);
  border-color: theme(colors.accent.DEFAULT);
  color: theme(colors.surface.DEFAULT);
  font-weight: 600;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }
</style>
```

- [ ] **Step 2: Write `app/components/Todo/Sidebar.vue`**

```vue
<script setup lang="ts">
import type { View } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'

defineProps<{
  view: View
  categoryId: number | null
  counts: {
    today: number
    overdue: number
    all: number
    week: number
    byCategory: Record<number, number>
  }
}>()
const emit = defineEmits<{
  (e: 'update:view', v: View): void
  (e: 'update:categoryId', id: number | null): void
}>()

const { categories } = useCategories()

function selectView(v: View) {
  emit('update:categoryId', null)
  emit('update:view', v)
}
function selectCategory(id: number) {
  emit('update:view', 'all')
  emit('update:categoryId', id)
}
</script>

<template>
  <aside class="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-ink-faint/10 bg-black/20 px-2 py-5 gap-5">
    <div class="px-3">
      <div class="font-display font-bold tracking-tight text-base">alola <span class="text-ink-faint">/todos</span></div>
    </div>

    <div class="flex flex-col">
      <div class="px-3 pb-2 text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-ink-faint">Views</div>
      <button class="side-item" :class="{ active: view === 'today' && categoryId === null }" @click="selectView('today')">
        Today <span class="ml-auto text-xs text-ink-faint">{{ counts.today }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'overdue' && categoryId === null }" @click="selectView('overdue')">
        Overdue <span class="ml-auto text-xs" :class="counts.overdue ? 'text-[#c7513a] font-semibold' : 'text-ink-faint'">{{ counts.overdue }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'all' && categoryId === null }" @click="selectView('all')">
        All <span class="ml-auto text-xs text-ink-faint">{{ counts.all }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'week' && categoryId === null }" @click="selectView('week')">
        This week <span class="ml-auto text-xs text-ink-faint">{{ counts.week }}</span>
      </button>
    </div>

    <div class="flex flex-col">
      <div class="px-3 pb-2 text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-ink-faint">Categories</div>
      <button
        v-for="c in categories"
        :key="c.id"
        class="side-item"
        :class="{ active: categoryId === c.id }"
        @click="selectCategory(c.id)"
      >
        <span class="inline-block w-2 h-2 rounded-full" :style="{ background: c.color }" />
        {{ c.name }}
        <span class="ml-auto text-xs text-ink-faint">{{ counts.byCategory[c.id] ?? 0 }}</span>
      </button>
      <NuxtLink to="/todos/settings/categories" class="side-item text-ink-faint font-normal">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
        New category
      </NuxtLink>
    </div>
  </aside>
</template>

<style scoped>
.side-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.5rem;
  color: theme(colors.ink.muted);
  font-size: 0.88rem;
  font-weight: 500;
  text-align: left;
  width: 100%;
  transition: background-color 0.1s;
}
.side-item:hover { background: rgba(255, 255, 255, 0.025); }
.side-item.active { background: theme(colors.surface.raised); color: theme(colors.ink.DEFAULT); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/FilterChips.vue app/components/Todo/Sidebar.vue
git commit -m "feat(todos): FilterChips and desktop Sidebar"
```

---

### Task 17: QuickAdd + QuickAddSheet

**Files:**
- Create: `app/components/Todo/QuickAdd.vue`
- Create: `app/components/Todo/QuickAddSheet.vue`

- [ ] **Step 1: Write `app/components/Todo/QuickAdd.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{
  (e: 'submit', title: string): void
  (e: 'expand'): void
}>()

const title = ref('')
const input = ref<HTMLInputElement | null>(null)

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('submit', t)
  title.value = ''
}

function focus() {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form class="mx-3 mb-2 flex items-center gap-0 rounded-2xl border border-ink-faint/15 bg-surface-raised px-3" @submit.prevent="submit">
    <svg viewBox="0 0 24 24" class="w-4 h-4 text-ink-muted shrink-0" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
    <input
      ref="input"
      v-model="title"
      type="text"
      placeholder="Add a task…"
      :disabled="disabled"
      class="flex-1 bg-transparent px-2 py-3 text-[0.95rem] outline-none placeholder:text-ink-faint"
      @keydown.meta.enter="submit"
      @keydown.ctrl.enter="submit"
    />
    <button
      type="button"
      :title="'Open full new-task sheet'"
      class="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
      @click="emit('expand')"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16"/></svg>
    </button>
  </form>
</template>
```

- [ ] **Step 2: Write `app/components/Todo/QuickAddSheet.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCategories } from '~/composables/useCategories'
import { todayAsDueAt, startOfToday, formatDueLabel } from '~/utils/date'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: {
    title: string
    notes?: string
    category_id?: number | null
    priority?: number
    due_at?: number | null
    subtasks?: { title: string; position?: number }[]
  }): void
}>()

const { categories } = useCategories()

const title = ref('')
const notes = ref('')
const categoryId = ref<number | null>(null)
const priority = ref<number>(2)
const dueAt = ref<number | null>(null)
const subtaskDrafts = ref<string[]>([])
const newSubtask = ref('')

function reset() {
  title.value = ''
  notes.value = ''
  categoryId.value = null
  priority.value = 2
  dueAt.value = null
  subtaskDrafts.value = []
  newSubtask.value = ''
}

function pickDateToday() {
  dueAt.value = dueAt.value === todayAsDueAt() ? null : todayAsDueAt()
}
function pickDateTomorrow() {
  const t = startOfToday() + 86400
  dueAt.value = dueAt.value === t ? null : t
}
function cyclePriority() {
  priority.value = priority.value === 3 ? 2 : priority.value === 2 ? 1 : 3
}
function priorityLabel(p: number) { return p === 3 ? 'High' : p === 2 ? 'Medium' : 'Low' }

function addSubtask() {
  const t = newSubtask.value.trim()
  if (!t) return
  subtaskDrafts.value = [...subtaskDrafts.value, t]
  newSubtask.value = ''
}

function removeSubtask(i: number) {
  subtaskDrafts.value = subtaskDrafts.value.filter((_, idx) => idx !== i)
}

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('submit', {
    title: t,
    notes: notes.value.trim() || undefined,
    category_id: categoryId.value,
    priority: priority.value,
    due_at: dueAt.value,
    subtasks: subtaskDrafts.value.map((s, i) => ({ title: s, position: i })),
  })
  reset()
}

const dueLabel = computed(() => formatDueLabel(dueAt.value).label || 'Due')
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/55" @click.self="emit('close')">
      <div class="w-full max-w-xl mx-auto rounded-t-3xl bg-surface-raised p-4 pb-6 shadow-2xl">
        <div class="w-9 h-1 mx-auto mb-3 rounded-full bg-ink-faint" />

        <input
          v-model="title"
          type="text"
          placeholder="New task"
          class="w-full bg-transparent font-display text-lg font-semibold outline-none py-2"
          autofocus
        />
        <textarea
          v-model="notes"
          placeholder="Notes (optional)"
          rows="2"
          class="w-full bg-transparent text-sm text-ink-muted outline-none py-1 resize-none"
        />

        <div class="flex flex-wrap gap-1.5 py-3 border-t border-ink-faint/10">
          <select
            v-model="categoryId"
            class="sheet-chip"
            :class="categoryId !== null && 'sheet-chip-set'"
          >
            <option :value="null">Category</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button type="button" class="sheet-chip" :class="priority !== 2 && 'sheet-chip-set'" @click="cyclePriority">
            {{ priority === 2 ? 'Priority' : priorityLabel(priority) }}
          </button>
          <button type="button" class="sheet-chip" :class="dueAt !== null && 'sheet-chip-set'" @click="pickDateToday">
            {{ dueAt !== null ? dueLabel : 'Today' }}
          </button>
          <button type="button" class="sheet-chip" :class="dueAt === startOfToday() + 86400 && 'sheet-chip-set'" @click="pickDateTomorrow">
            Tomorrow
          </button>
        </div>

        <div class="flex flex-col gap-1 py-1">
          <div v-for="(s, i) in subtaskDrafts" :key="i" class="flex items-center gap-2 text-sm py-1">
            <span class="w-4 h-4 rounded-full border border-ink-faint" />
            <span class="flex-1">{{ s }}</span>
            <button type="button" class="text-xs text-ink-faint hover:text-ink" @click="removeSubtask(i)">remove</button>
          </div>
          <input
            v-model="newSubtask"
            placeholder="Add subtask"
            class="bg-transparent text-sm py-1 outline-none placeholder:text-ink-faint"
            @keydown.enter.prevent="addSubtask"
          />
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-ink-faint/10 mt-2">
          <button type="button" class="text-sm text-ink-muted px-2 py-2" @click="emit('close')">Cancel</button>
          <button type="button" class="bg-accent text-surface px-4 py-2 rounded-lg font-semibold text-sm" @click="submit">
            Add task
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-chip {
  background: theme(colors.surface.subtle);
  border: 1px solid theme(colors.surface.subtle);
  color: theme(colors.ink.muted);
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
}
.sheet-chip-set {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.3);
  color: theme(colors.accent.light);
}
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/QuickAdd.vue app/components/Todo/QuickAddSheet.vue
git commit -m "feat(todos): QuickAdd bar and expanded QuickAddSheet"
```

---

### Task 18: Subtask components

**Files:**
- Create: `app/components/Todo/SubtaskRow.vue`
- Create: `app/components/Todo/SubtaskList.vue`

- [ ] **Step 1: Write `app/components/Todo/SubtaskRow.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { Subtask } from '~/composables/useTasks'
import CheckCircle from '~/components/Todo/CheckCircle.vue'

const props = defineProps<{ subtask: Subtask }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'delete'): void
  (e: 'rename', title: string): void
}>()

const editing = ref(false)
const draft = ref('')

function startEdit() {
  draft.value = props.subtask.title
  editing.value = true
}
function commit() {
  const t = draft.value.trim()
  if (!t) return editing.value = false
  if (t !== props.subtask.title) emit('rename', t)
  editing.value = false
}
</script>

<template>
  <div class="flex items-center gap-2 px-1 py-1.5 border-b border-ink-faint/5 last:border-b-0">
    <CheckCircle :checked="subtask.completed_at !== null" size="sm" @toggle="emit('toggle')" />
    <input
      v-if="editing"
      v-model="draft"
      class="flex-1 bg-transparent text-sm outline-none"
      autofocus
      @blur="commit"
      @keydown.enter.prevent="commit"
      @keydown.esc="editing = false"
    />
    <span
      v-else
      class="flex-1 text-sm cursor-text"
      :class="subtask.completed_at !== null && 'line-through text-ink-faint'"
      @click="startEdit"
    >{{ subtask.title }}</span>
    <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="emit('delete')" aria-label="Delete subtask">
      ×
    </button>
  </div>
</template>
```

- [ ] **Step 2: Write `app/components/Todo/SubtaskList.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Subtask } from '~/composables/useTasks'
import SubtaskRow from '~/components/Todo/SubtaskRow.vue'

const props = defineProps<{ subtasks: Subtask[] }>()
const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'delete', id: number): void
  (e: 'rename', id: number, title: string): void
  (e: 'add', title: string): void
}>()

const draft = ref('')

const progress = computed(() => {
  const total = props.subtasks.length
  if (total === 0) return null
  const done = props.subtasks.filter(s => s.completed_at !== null).length
  return { done, total, pct: Math.round((done / total) * 100) }
})

function addOne() {
  const t = draft.value.trim()
  if (!t) return
  emit('add', t)
  draft.value = ''
}
</script>

<template>
  <div>
    <div v-if="progress" class="h-[3px] bg-surface-subtle rounded overflow-hidden mb-2">
      <div class="h-full bg-accent transition-[width] duration-200" :style="{ width: `${progress.pct}%` }" />
    </div>

    <SubtaskRow
      v-for="s in subtasks"
      :key="s.id"
      :subtask="s"
      @toggle="emit('toggle', s.id)"
      @delete="emit('delete', s.id)"
      @rename="(t) => emit('rename', s.id, t)"
    />

    <div class="flex items-center gap-2 mt-2 py-1">
      <span class="w-[18px] h-[18px] rounded-full border border-dashed border-ink-faint inline-flex items-center justify-center text-ink-faint text-xs">+</span>
      <input
        v-model="draft"
        class="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        placeholder="Add subtask"
        @keydown.enter.prevent="addOne"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/SubtaskRow.vue app/components/Todo/SubtaskList.vue
git commit -m "feat(todos): SubtaskRow and SubtaskList components"
```

---

### Task 19: TaskDetail component

**Files:**
- Create: `app/components/Todo/TaskDetail.vue`

- [ ] **Step 1: Write `app/components/Todo/TaskDetail.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'
import { formatDueLabel, startOfToday } from '~/utils/date'
import SubtaskList from '~/components/Todo/SubtaskList.vue'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'patch', patch: Partial<Pick<Task, 'title' | 'notes' | 'category_id' | 'priority' | 'due_at'>>): void
  (e: 'delete'): void
  (e: 'toggle'): void
  (e: 'add-subtask', title: string): void
  (e: 'toggle-subtask', id: number): void
  (e: 'delete-subtask', id: number): void
  (e: 'rename-subtask', id: number, title: string): void
}>()

const { categories } = useCategories()

const title = ref(props.task.title)
const notes = ref(props.task.notes ?? '')
const categoryId = ref<number | null>(props.task.category_id)
const priority = ref<number>(props.task.priority)
const dueAt = ref<number | null>(props.task.due_at)

watch(() => props.task, (t) => {
  title.value = t.title
  notes.value = t.notes ?? ''
  categoryId.value = t.category_id
  priority.value = t.priority
  dueAt.value = t.due_at
})

function commitTitle() {
  const t = title.value.trim()
  if (!t || t === props.task.title) { title.value = props.task.title; return }
  emit('patch', { title: t })
}
function commitNotes() {
  const n = notes.value.trim() || null
  if (n === (props.task.notes ?? null)) return
  emit('patch', { notes: n })
}
function setCategory(id: number | null) {
  if (id === props.task.category_id) return
  emit('patch', { category_id: id })
}
function setPriority(p: number) {
  if (p === props.task.priority) return
  emit('patch', { priority: p })
}
function setDueOffset(daysFromToday: number | null) {
  const due = daysFromToday === null ? null : startOfToday() + daysFromToday * 86400
  if (due === props.task.due_at) return
  emit('patch', { due_at: due })
}

const dueLabel = computed(() => formatDueLabel(dueAt.value).label || '—')
const category = computed(() => categoryId.value === null ? null : categories.value.find(c => c.id === categoryId.value) ?? null)
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-surface">
    <header class="flex items-center justify-between px-4 py-3 border-b border-ink-faint/10">
      <button type="button" class="text-sm text-ink-muted flex items-center gap-1" @click="emit('close')" aria-label="Close">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </button>
      <button type="button" class="text-[#c7513a] hover:opacity-80" @click="emit('delete')" aria-label="Delete task">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
      <input
        v-model="title"
        class="font-display text-[1.3rem] font-semibold bg-transparent outline-none leading-tight"
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
      />

      <div class="grid grid-cols-2 gap-2">
        <label class="meta-tile">
          <span class="k">Category</span>
          <select class="v bg-transparent outline-none" :value="categoryId ?? ''" @change="(e: any) => setCategory(e.target.value === '' ? null : Number(e.target.value))">
            <option value="">None</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="meta-tile">
          <span class="k">Priority</span>
          <select class="v bg-transparent outline-none" :value="priority" @change="(e: any) => setPriority(Number(e.target.value))">
            <option :value="3">High</option>
            <option :value="2">Medium</option>
            <option :value="1">Low</option>
          </select>
        </label>
        <label class="meta-tile col-span-2">
          <span class="k">Due</span>
          <div class="flex gap-2 items-center">
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(0)">Today</button>
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(1)">Tomorrow</button>
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(7)">Next week</button>
            <button type="button" class="text-xs underline text-ink-faint" @click="setDueOffset(null)">Clear</button>
            <span class="ml-auto text-sm">{{ dueLabel }}</span>
          </div>
        </label>
      </div>

      <section>
        <h3 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Notes</h3>
        <textarea
          v-model="notes"
          class="w-full bg-surface-raised/60 text-sm p-3 rounded-lg outline-none resize-y min-h-[70px]"
          placeholder="Add notes…"
          @blur="commitNotes"
        />
      </section>

      <section>
        <h3 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2 flex justify-between">
          <span>Subtasks</span>
          <span class="lowercase tracking-normal text-ink-muted text-xs">{{ task.subtasks.filter(s => s.completed_at !== null).length }} of {{ task.subtasks.length }}</span>
        </h3>
        <SubtaskList
          :subtasks="task.subtasks"
          @toggle="(id) => emit('toggle-subtask', id)"
          @delete="(id) => emit('delete-subtask', id)"
          @rename="(id, t) => emit('rename-subtask', id, t)"
          @add="(t) => emit('add-subtask', t)"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.meta-tile {
  background: theme(colors.surface.raised);
  border: 1px solid theme(colors.surface.subtle);
  border-radius: 0.6rem;
  padding: 0.5rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.k { font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: theme(colors.ink.faint); font-weight: 600; }
.v { font-size: 0.85rem; color: theme(colors.ink.DEFAULT); font-weight: 500; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Todo/TaskDetail.vue
git commit -m "feat(todos): TaskDetail panel component"
```

---

### Task 20: Snackbar

**Files:**
- Create: `app/components/Todo/Snackbar.vue`

- [ ] **Step 1: Write `app/components/Todo/Snackbar.vue`**

```vue
<script setup lang="ts">
import { useUndoSnackbar } from '~/composables/useUndoSnackbar'
const { active, undo, dismiss } = useUndoSnackbar()
</script>

<template>
  <Transition name="snack">
    <div
      v-if="active"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-raised border border-ink-faint/15 rounded-lg px-4 py-2 shadow-xl text-sm"
      role="status"
    >
      <span class="text-ink">{{ active.message }}</span>
      <button v-if="active.onUndo" type="button" class="text-accent-light font-semibold" @click="undo">Undo</button>
      <button type="button" class="text-ink-faint px-1" @click="dismiss" aria-label="Dismiss">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.snack-enter-active, .snack-leave-active { transition: transform 0.2s, opacity 0.2s; }
.snack-enter-from, .snack-leave-to { transform: translate(-50%, 8px); opacity: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Todo/Snackbar.vue
git commit -m "feat(todos): Snackbar component"
```

---

### Task 21: Rewrite `/todos/index.vue` to integrate everything

**Files:**
- Modify: `app/pages/todos/index.vue` (wholesale rewrite — replaces the Plan 1 placeholder)

- [ ] **Step 1: Replace `app/pages/todos/index.vue` with this content**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, definePageMeta } from '#imports'
import { useSession } from '~/composables/useSession'
import { useCategories } from '~/composables/useCategories'
import { useTasks, type View } from '~/composables/useTasks'
import { useCurrentView } from '~/composables/useCurrentView'
import { useUndoSnackbar } from '~/composables/useUndoSnackbar'
import { startOfToday, startOfTomorrow, startOfNextWeek } from '~/utils/date'

import Sidebar from '~/components/Todo/Sidebar.vue'
import QuickAdd from '~/components/Todo/QuickAdd.vue'
import QuickAddSheet from '~/components/Todo/QuickAddSheet.vue'
import FilterChips from '~/components/Todo/FilterChips.vue'
import TaskList from '~/components/Todo/TaskList.vue'
import TaskDetail from '~/components/Todo/TaskDetail.vue'
import Snackbar from '~/components/Todo/Snackbar.vue'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Todos' })

const route = useRoute()
const router = useRouter()

const { user, logout } = useSession()
const categoriesStore = useCategories()
const tasksStore = useTasks()
const { view, categoryId, selectedTaskId } = useCurrentView()
const snack = useUndoSnackbar()

const sheetOpen = ref(false)
const quickAdd = ref<InstanceType<typeof QuickAdd> | null>(null)

// Initial load.
onMounted(async () => {
  await Promise.all([
    categoriesStore.refresh(),
    tasksStore.refresh('all'),  // server returns full "visible" set; client filters from there
  ])
  // PWA manifest shortcut: ?new=1 opens the expanded sheet.
  if (route.query.new === '1') {
    sheetOpen.value = true
    // Strip the param from URL so reload doesn't re-trigger.
    const q = { ...route.query }
    delete q.new
    router.replace({ query: q })
  }
})

// Keyboard: 'n' focuses quick-add. 'x' completes selected task.
function onKey(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
  if (e.key === 'n') { e.preventDefault(); quickAdd.value?.focus() }
  if (e.key === 'x' && selectedTaskId.value !== null) onToggle(selectedTaskId.value)
}
onMounted(() => window.addEventListener('keydown', onKey))
// watch cleanup — we'd use onUnmounted, but page unmounts reliably via Nuxt
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKey))

// --- Projection ---
const visibleTasks = computed(() => {
  const p = tasksStore.projection(view.value, categoryId.value)
  return p.value
})

// --- Counts for sidebar ---
const counts = computed(() => {
  const today = startOfToday()
  const tomorrow = startOfTomorrow()
  const nextWeek = startOfNextWeek()
  const all = tasksStore.tasks.value
  const byCategory: Record<number, number> = {}
  let todayCount = 0, overdueCount = 0, allCount = 0, weekCount = 0
  for (const t of all) {
    if (t.completed_at !== null && t.completed_at < today) continue
    if (t.completed_at !== null) continue  // completed today doesn't contribute to active counts
    allCount++
    if (t.due_at === null || t.due_at < tomorrow) todayCount++
    if (t.due_at !== null && t.due_at < today) overdueCount++
    if (t.due_at === null || t.due_at < nextWeek) weekCount++
    if (t.category_id !== null) byCategory[t.category_id] = (byCategory[t.category_id] ?? 0) + 1
  }
  return { today: todayCount, overdue: overdueCount, all: allCount, week: weekCount, byCategory }
})

// --- Handlers ---
async function onQuickSubmit(title: string) {
  try {
    await tasksStore.create({ title, category_id: categoryId.value })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to add task')
  }
}

async function onSheetSubmit(payload: any) {
  sheetOpen.value = false
  try {
    await tasksStore.create(payload)
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to add task')
  }
}

async function onToggle(id: number) {
  const t = tasksStore.tasks.value.find(x => x.id === id)
  if (!t) return
  try {
    if (t.completed_at === null) await tasksStore.complete(id)
    else await tasksStore.uncomplete(id)
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to update task')
  }
}

async function onSwipeComplete(id: number) {
  try {
    await tasksStore.complete(id)
    snack.show('Completed', async () => { await tasksStore.uncomplete(id) })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to complete')
  }
}

async function onSwipeDelete(id: number) {
  const t = tasksStore.tasks.value.find(x => x.id === id)
  if (!t) return
  const snapshot = JSON.parse(JSON.stringify(t))
  try {
    await tasksStore.destroy(id)
    snack.show('Deleted', async () => {
      // Best-effort undo: recreate with the same fields. New id. Good enough for v1.
      await tasksStore.create({
        title: snapshot.title,
        notes: snapshot.notes ?? undefined,
        category_id: snapshot.category_id ?? undefined,
        priority: snapshot.priority,
        due_at: snapshot.due_at ?? undefined,
      })
    })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to delete')
  }
}

function onOpen(id: number) {
  selectedTaskId.value = id
}
function closeDetail() {
  selectedTaskId.value = null
}

async function onDetailPatch(patch: any) {
  if (selectedTaskId.value === null) return
  try { await tasksStore.update(selectedTaskId.value, patch) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to update') }
}
async function onDetailDelete() {
  if (selectedTaskId.value === null) return
  const id = selectedTaskId.value
  selectedTaskId.value = null
  await onSwipeDelete(id)
}
async function onDetailAddSubtask(title: string) {
  if (selectedTaskId.value === null) return
  try { await tasksStore.addSubtask(selectedTaskId.value, title) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to add subtask') }
}
async function onDetailToggleSubtask(id: number) {
  try { await tasksStore.toggleSubtask(id) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to toggle subtask') }
}
async function onDetailDeleteSubtask(id: number) {
  try { await tasksStore.deleteSubtask(id) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to delete subtask') }
}
async function onDetailRenameSubtask(id: number, title: string) {
  try { await tasksStore.updateSubtask(id, { title }) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to rename subtask') }
}

const selectedTask = computed(() => selectedTaskId.value === null ? null : tasksStore.tasks.value.find(t => t.id === selectedTaskId.value) ?? null)

const viewTitle = computed(() => {
  if (categoryId.value !== null) {
    return categoriesStore.byId.value.get(categoryId.value)?.name ?? 'Category'
  }
  return { today: 'Today', overdue: 'Overdue', week: 'This week', all: 'All tasks' }[view.value]
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-0px)] lg:min-h-screen lg:max-h-screen lg:overflow-hidden -mx-4 -mt-4 lg:-mx-6 lg:-mt-6">
    <Sidebar
      :view="view"
      :category-id="categoryId"
      :counts="counts"
      @update:view="(v) => (view = v)"
      @update:categoryId="(id) => (categoryId = id)"
    />

    <!-- Main column: list + optional desktop detail -->
    <div class="flex-1 min-w-0 flex">
      <!-- List pane -->
      <section class="flex-1 min-w-0 flex flex-col" :class="selectedTaskId !== null && 'hidden md:flex'">
        <header class="flex items-baseline justify-between px-4 pt-4 lg:pt-6 pb-2">
          <div>
            <h1 class="font-display text-2xl font-bold tracking-tight">{{ viewTitle }}</h1>
            <p class="text-xs text-ink-muted">Signed in as {{ user?.email }}</p>
          </div>
          <button class="text-xs uppercase tracking-wider text-ink-muted border border-ink-faint/20 rounded-md px-2 py-1 hover:text-ink" @click="logout">
            Sign out
          </button>
        </header>

        <QuickAdd ref="quickAdd" @submit="onQuickSubmit" @expand="sheetOpen = true" />
        <FilterChips :view="view" :category-id="categoryId" @update:view="(v) => (view = v)" @update:categoryId="(id) => (categoryId = id)" />

        <div class="flex-1 overflow-y-auto px-1 pb-20">
          <TaskList
            :tasks="visibleTasks"
            :view="view"
            :selected-task-id="selectedTaskId"
            @toggle="onToggle"
            @open="onOpen"
            @swipe-complete="onSwipeComplete"
            @swipe-delete="onSwipeDelete"
          />
        </div>
      </section>

      <!-- Detail pane -->
      <section
        v-if="selectedTask"
        class="flex-1 min-w-0 md:flex-[0_0_400px] border-l border-ink-faint/10 bg-surface"
        :class="selectedTaskId === null && 'hidden'"
      >
        <TaskDetail
          :task="selectedTask"
          @close="closeDetail"
          @patch="onDetailPatch"
          @delete="onDetailDelete"
          @toggle="onToggle(selectedTask!.id)"
          @add-subtask="onDetailAddSubtask"
          @toggle-subtask="onDetailToggleSubtask"
          @delete-subtask="onDetailDeleteSubtask"
          @rename-subtask="onDetailRenameSubtask"
        />
      </section>
    </div>

    <QuickAddSheet :open="sheetOpen" @close="sheetOpen = false" @submit="onSheetSubmit" />
    <Snackbar />
  </div>
</template>
```

- [ ] **Step 2: Verify build**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-core-ux
npx nuxi prepare
```

Expect: `Types generated in .nuxt.` If anything barfs about missing imports, fix inline.

- [ ] **Step 3: Commit**

```bash
git add app/pages/todos/index.vue
git commit -m "feat(todos): integrate Todos home view with sidebar, list, detail, quick-add"
```

---

### Task 22: Settings pages

**Files:**
- Create: `app/pages/todos/settings/index.vue`
- Create: `app/pages/todos/settings/categories.vue`

- [ ] **Step 1: Write `app/pages/todos/settings/index.vue`**

```vue
<script setup lang="ts">
import { definePageMeta } from '#imports'
definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Settings' })
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos" class="text-xs uppercase tracking-wider text-ink-muted">← Back to todos</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Settings</h1>
    </header>

    <nav class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
      <NuxtLink to="/todos/settings/categories" class="flex items-center justify-between px-4 py-3 hover:bg-surface-raised">
        <span>Categories</span>
        <span class="text-ink-faint">›</span>
      </NuxtLink>
    </nav>
  </div>
</template>
```

- [ ] **Step 2: Write `app/pages/todos/settings/categories.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { definePageMeta } from '#imports'
import { useCategories, type Category } from '~/composables/useCategories'
import { onMounted } from 'vue'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Categories' })

const { categories, refresh, create, update, remove, loaded } = useCategories()

const newName = ref('')
const newColor = ref('#4a7c59')
const error = ref<string | null>(null)

const SUGGESTED_COLORS = ['#4a7c59', '#3b82f6', '#8b5cf6', '#e879c8', '#d97706', '#14b8a6', '#ef4444', '#a855f7']

onMounted(async () => { if (!loaded.value) await refresh() })

async function addCategory() {
  error.value = null
  try {
    await create({ name: newName.value.trim(), color: newColor.value, position: categories.value.length })
    newName.value = ''
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Could not create category'
  }
}

async function renameCategory(c: Category, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed === c.name) return
  try { await update(c.id, { name: trimmed }) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Rename failed' }
}

async function recolor(c: Category, color: string) {
  if (color === c.color) return
  try { await update(c.id, { color }) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Recolour failed' }
}

async function removeCategory(c: Category) {
  if (!confirm(`Delete category "${c.name}"? Tasks in it become uncategorised.`)) return
  try { await remove(c.id) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Delete failed' }
}
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Categories</h1>
    </header>

    <form class="flex items-center gap-2 rounded-xl border border-ink-faint/15 bg-surface-raised px-3 py-2" @submit.prevent="addCategory">
      <select v-model="newColor" class="bg-transparent outline-none text-sm">
        <option v-for="c in SUGGESTED_COLORS" :key="c" :value="c" :style="{ color: c }">{{ c }}</option>
      </select>
      <input v-model="newName" placeholder="New category name" class="flex-1 bg-transparent outline-none py-2" />
      <button type="submit" class="bg-accent text-surface px-3 py-1.5 rounded text-sm font-semibold">Add</button>
    </form>
    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

    <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
      <li v-for="c in categories" :key="c.id" class="flex items-center gap-3 px-4 py-3">
        <input
          type="color"
          :value="c.color"
          class="w-5 h-5 rounded-full border-none bg-transparent cursor-pointer p-0"
          @change="(e: any) => recolor(c, e.target.value)"
        />
        <input
          :value="c.name"
          class="flex-1 bg-transparent outline-none text-sm"
          @blur="(e: any) => renameCategory(c, e.target.value)"
          @keydown.enter.prevent="(e: any) => renameCategory(c, e.target.value)"
        />
        <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="removeCategory(c)">Delete</button>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add app/pages/todos/settings/index.vue app/pages/todos/settings/categories.vue
git commit -m "feat(todos): settings hub + categories CRUD page"
```

---

### Task 23: Local end-to-end smoke test

No code changes — this is verification. Do every check; fix anything that breaks before Task 24.

- [ ] **Step 1: Start the dev server**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-core-ux
npm run dev
```

- [ ] **Step 2: Mobile-viewport checks** — DevTools mobile emulation (375×812):

1. `/todos/login` → sign in → lands on `/todos` showing "Today" view.
2. Type a title in the quick-add bar, press Enter → task appears in "Today".
3. Tap the expand drawer (right side) → sheet opens. Fill title + category + priority + due date + one subtask → "Add task" → appears in the list.
4. Tap the round checkbox → task moves to "Completed today" section.
5. Swipe right on a row → green background reveals, then rubber-band back + "Completed" snackbar.
6. Tap Undo on the snackbar → task goes back to uncompleted.
7. Swipe left on a row → red background reveals, task disappears, snackbar shows with Undo.
8. Tap a task row → detail view opens.
9. Edit title in detail → commits on blur.
10. Change priority/category/due via the selects → row updates in the list behind.
11. Add a subtask in detail → toggle it → delete it.
12. Click × or Back → returns to list.
13. Filter chips: "All", "This week", each category chip → list narrows accordingly.
14. Tap a category chip then clear with "Today" → back to full today view.
15. Navigate to `/todos/settings/categories` → add a new category → rename → recolour → delete.
16. Sign out → back at `/todos/login`.

- [ ] **Step 3: Desktop-viewport checks** — browser >= 1024px wide:

1. Sidebar is visible on the left with Views + Categories.
2. Counts in the sidebar update as you complete/add tasks.
3. Clicking a task in the list opens the detail in the right pane (both visible).
4. Clicking another task swaps the detail without flicker.
5. Pressing `n` on keyboard focuses the quick-add input.
6. With a task selected, pressing `x` completes it.

- [ ] **Step 4: PWA manifest shortcut emulation**

Browse to `http://localhost:3000/todos?new=1` directly → the Quick-Add sheet should open on mount and the URL should strip the `new=1` param.

- [ ] **Step 5: Auto-hide sanity**

1. Complete any task now → it appears under "Completed today".
2. In DevTools, set system clock forward a day (or wait until tomorrow) → the completed task should vanish from default views.
3. (Lightweight verification: just check the filter logic in `useTasks.ts` — `completed_at < startOfToday()` hides it.)

- [ ] **Step 6: Network sanity** — DevTools → Network tab:

1. Every mutation (create, update, delete, complete, uncomplete, toggle-subtask) fires a single request to the right endpoint with `X-CSRF-Token`.
2. Every request carries the `Cookie: alola_session=…` header.
3. All responses are `2xx`; only 422/401/403/429 on deliberate misuse.

- [ ] **Step 7: CSRF enforcement is still green**

```bash
curl -s -c /tmp/alola.cookies -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"glawton@alola.org","password":"<YOUR_DEV_PASSWORD>"}'
curl -i -b /tmp/alola.cookies -X POST http://localhost:3000/api/tasks \
  -H 'content-type: application/json' \
  -d '{"client_id":"abcd1234abcd","title":"no csrf"}'
# expect 403 CSRF missing

CSRF=$(awk '/alola_csrf/ {print $NF}' /tmp/alola.cookies)
curl -i -b /tmp/alola.cookies -X POST http://localhost:3000/api/tasks \
  -H 'content-type: application/json' \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"client_id":"abcd1234abcde","title":"with csrf"}'
# expect 201
```

If every check passes, Plan 2 is ready to ship. If anything breaks, commit a fix and re-verify before Task 24.

---

### Task 24: Merge to master + deploy

**Files:**
- None (operational)

- [ ] **Step 1: Confirm feature branch is clean and up-to-date**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-core-ux
git status       # should be clean
git log --oneline master..HEAD | wc -l    # should show ~22 commits
```

- [ ] **Step 2: Merge + push from the main checkout**

```bash
cd /home/graemel/workspace/alola
git checkout master
git pull --ff-only
git merge --no-ff feat/todos-core-ux -m "Merge plan 2: core task UX (online-only)"
git push origin master
```

Vercel's Git integration picks this up and builds automatically. Usually 1-2 min.

- [ ] **Step 3: Verify production**

```bash
# Wait ~90s after push, then:
curl -sI https://alola.org/todos | head -5
# expect HTTP/2 200, server: Vercel, fresh age
```

Open `https://alola.org/todos` in a browser, log in, and run through a small subset of Task 23's checks (add a task, complete it via swipe, undo, add a subtask via detail, delete a category). Prod uses the prod Turso DB — changes here are real.

- [ ] **Step 4: Cleanup**

```bash
git worktree remove ~/.config/superpowers/worktrees/alola/todos-core-ux
git branch -d feat/todos-core-ux
git worktree list
git branch -vv
```

Plan 2 shipped.

---

## Self-review notes (author)

- **Spec coverage:** every v1 feature in the "scope — feature decisions" table of the spec is built here: categories CRUD, priorities (H/M/L), due dates, subtasks, notes, complete/uncomplete, filter + sort, auto-hide, PWA shortcut query params (`?new=1`), swipe-to-complete/delete with undo, mobile + desktop layouts, detail view, settings page. Out-of-scope items (recurring tasks, push notifications, NLP quick-add, PWA install/offline, API keys) remain deferred to Plans 3/4.
- **Type consistency:** `Task` and `Subtask` interfaces defined in `useTasks.ts` are the single source of truth. `View` is defined there too. `Category` lives in `useCategories.ts`. All components import from these two files only.
- **No placeholders:** every step has concrete code or exact commands with expected output. No "add error handling" hand-waves — where error UX matters, the snackbar path is explicit.
- **Known open point for Plan 3:** the swipe-delete undo is best-effort — it re-creates the task with a fresh id rather than restoring the original row. Plan 3's offline queue + IndexedDB can track an "unsent delete" and make undo exact (cancel the queued mutation). This is flagged in-line in `onSwipeDelete` and acceptable for v2.
- **Keyboard shortcuts:** `n` focus quick-add and `x` toggle selected — the two from the spec's "light" set that have clear UX payoff. `J`/`K` navigation and `/` search are not in v1 and are not secretly half-built anywhere.
- **Server-side filters** compute `startOfTodayInTz` server-side using the user's stored tz; client-side projections use browser tz. For a single user in one tz this produces identical results. If the user's stored tz and browser tz ever diverge, the server response is authoritative and client projections will be close enough — not worth a full rewrite.
