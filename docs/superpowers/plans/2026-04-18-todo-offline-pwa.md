# Todo App — Plan 3 of 4: Offline + PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/todos` installable as a home-screen PWA on iOS and Android, viewable offline (with an IndexedDB snapshot), and capture-capable offline (mutations queue in IndexedDB and flush when connectivity returns). Close the loop with a proper nonce-based Content-Security-Policy.

**Architecture:** `@vite-pwa/nuxt` in `injectManifest` mode owns the service worker (app-shell precache + GET stale-while-revalidate for the task/category endpoints). The mutation queue lives in the **main thread** (per spec), using `idb` for storage; mutations write through the in-memory store, enqueue to IndexedDB, then attempt the network. Flush triggers: `online` event, tab-visibility becoming visible, manual tap. Last-write-wins by `updated_at`; idempotent creates via `client_id` (server already enforces this from Plan 1). A `SyncIndicator` surfaces queue state (green / amber / red). CSP nonces are reintroduced via `nuxt-security` so Nuxt's SSR hydration still works.

**Tech Stack:** Nuxt 4, `@vite-pwa/nuxt` (injectManifest), `workbox-window`, `idb`, `nuxt-security`, Vercel Node runtime.

**Spec:** `docs/superpowers/specs/2026-04-18-todo-app-design.md`

**Predecessors:**
- Plan 1 (`2026-04-18-todo-backend-skeleton.md`) — shipped.
- Plan 2 (`2026-04-18-todo-core-ux.md`) — shipped. Full online-only task UX already in place; composables, components, and pages all built.

**Next plan:** Plan 4 — API keys + external integrations (AI chat, e-ink poller).

**No test framework** is configured. Each task has manual verification; a full mobile + offline smoke test closes the plan (Task 18).

---

## File Structure

**Create:**
- `server/api/todos/manifest.webmanifest.get.ts` — serves the scoped web manifest (Content-Type set correctly)
- `app/utils/idb.ts` — typed `idb` wrapper with the IndexedDB schema
- `app/composables/useOnline.ts` — reactive `navigator.onLine` state
- `app/composables/useSyncQueue.ts` — queue CRUD + flush loop + retry + status
- `app/plugins/pwa.client.ts` — initialises sync queue and online listener on app boot (Nuxt plugin)
- `app/components/Todo/SyncIndicator.vue`
- `app/components/Todo/OfflineBanner.vue`
- `app/components/Todo/InstallHint.vue` — Android deferred prompt + iOS "Add to Home Screen" hint
- `public/service-worker.ts` — Workbox source (consumed by `@vite-pwa/nuxt` in `injectManifest` mode)

**Modify:**
- `nuxt.config.ts` — add `@vite-pwa/nuxt` and `nuxt-security` modules; link the PWA manifest from the `app/layouts/app.vue` head (not the public site layout)
- `app/composables/useCategories.ts` — hydrate from IDB on boot, persist on refresh, enqueue mutations
- `app/composables/useTasks.ts` — same pattern for tasks + subtasks
- `app/pages/todos/index.vue` — wire `SyncIndicator`, `OfflineBanner`, `InstallHint`
- `app/layouts/app.vue` — link the manifest (scoped so it only loads on `/todos/*`)
- `package.json` — add deps

**Not modified (no change needed):** All server routes, all other components, all pages except `index.vue`, all migrations.

---

## Prerequisites (one-time, before Task 1)

- [ ] **Create a fresh worktree**

```bash
cd /home/graemel/workspace/alola
git worktree add ~/.config/superpowers/worktrees/alola/todos-offline-pwa -b feat/todos-offline-pwa
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npm install
```

- [ ] **Copy dev `.env` so `nuxi prepare` and the dev server work**

```bash
# Paste your dev Turso URL/token + SEED_USER_PASSWORD into:
cp .env.example .env
# edit .env with the same dev values you've used in previous plans
```

- [ ] **Verify baseline**: `npm run dev` → log in at `/todos/login` → see the working home view from Plan 2. Ctrl+C once confirmed.

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + build deps**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npm install idb
npm install --save-dev @vite-pwa/nuxt workbox-window nuxt-security
```

`idb` is the runtime typed IndexedDB wrapper. `@vite-pwa/nuxt` and `workbox-window` handle the service-worker build + registration. `nuxt-security` reintroduces CSP with nonces.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(todos): add PWA + offline deps (idb, vite-pwa, workbox-window, security)"
```

---

### Task 2: Serve the PWA manifest from a Nuxt server route

**Files:**
- Create: `server/api/todos/manifest.webmanifest.get.ts`

Serving the manifest from a server route (vs a static file in `public/`) lets us set the exact `Content-Type` header and keep the scope-sensitive behaviour inline with the rest of the `/api/*` tree.

- [ ] **Step 1: Write `server/api/todos/manifest.webmanifest.get.ts`**

```ts
// server/api/todos/manifest.webmanifest.get.ts — scoped PWA manifest.
// Linked only from the app layout so the public marketing site is unaffected.
import { defineEventHandler, setHeader } from 'h3'

const MANIFEST = {
  name: 'alola todos',
  short_name: 'todos',
  scope: '/todos/',
  start_url: '/todos/?utm_source=pwa',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#141210',
  background_color: '#141210',
  icons: [
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'New task', short_name: 'New', url: '/todos/?new=1' },
    { name: 'Today',    short_name: 'Today', url: '/todos/' },
    { name: 'Overdue',  short_name: 'Overdue', url: '/todos/?view=overdue' },
  ],
}

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/manifest+json; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return MANIFEST
})
```

We reuse the existing `android-chrome-*.png` files from `public/`. Using the same file for both `any` and `maskable` accepts a possible logo crop on Android — acceptable for v1; we can ship a padded maskable variant later.

- [ ] **Step 2: Commit**

```bash
git add server/api/todos/manifest.webmanifest.get.ts
git commit -m "feat(todos): serve scoped PWA manifest at /api/todos/manifest.webmanifest"
```

---

### Task 3: Link the manifest from the app layout

**Files:**
- Modify: `app/layouts/app.vue`

The public marketing layout (`default.vue`) keeps its own `site.webmanifest` reference unchanged — only `/todos/*` gets the PWA manifest.

- [ ] **Step 1: Add a `useHead` link in `app/layouts/app.vue`**

Read the current file, then prepend a `<script setup>` block (there isn't one currently — the file is template + style only).

Current `app/layouts/app.vue` starts with `<template>`. Replace the top of the file (before `<template>`) with:

```vue
<script setup lang="ts">
useHead({
  link: [
    { rel: 'manifest', href: '/api/todos/manifest.webmanifest' },
  ],
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'todos' },
  ],
})
</script>

<template>
```

Leave the existing `<template>`, `<style scoped>`, and unscoped `<style>` blocks unchanged.

- [ ] **Step 2: Verify**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npx nuxi prepare
```

Expected: `Types generated in .nuxt.`

- [ ] **Step 3: Commit**

```bash
git add app/layouts/app.vue
git commit -m "feat(todos): link PWA manifest from app layout only"
```

---

### Task 4: IndexedDB wrapper

**Files:**
- Create: `app/utils/idb.ts`

Single-entry typed wrapper around `idb`. Exposes an async `idbGet` / `idbGetAll` / `idbPut` / `idbDelete` API plus a one-time migration. We version the schema as `1` for now — later bumps will use `idb.openDB`'s `upgrade` callback.

- [ ] **Step 1: Write `app/utils/idb.ts`**

```ts
// app/utils/idb.ts — typed IndexedDB wrapper for the todos app.
import { openDB, type IDBPDatabase } from 'idb'
import type { Task, Subtask } from '~/composables/useTasks'
import type { Category } from '~/composables/useCategories'

const DB_NAME = 'alola_todos'
const DB_VERSION = 1

/** The shape of a queued mutation waiting to flush to the server. */
export interface PendingMutation {
  /** Auto-incremented when written. */
  id?: number
  /** The fetch URL, e.g. `/api/tasks/42/complete`. */
  url: string
  /** HTTP method. */
  method: 'POST' | 'PATCH' | 'DELETE'
  /** JSON body (undefined for DELETE / complete / uncomplete). */
  body?: unknown
  /** Client-generated id used by create endpoints for idempotency. */
  clientId?: string
  /** Unix ms when the mutation was first enqueued. */
  createdAt: number
  /** Number of send attempts so far. */
  retries: number
}

/** Simple key/value record keyed on `key`. */
export interface MetaRow {
  key: string
  value: unknown
}

let _dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('tasks')) {
        database.createObjectStore('tasks', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('categories')) {
        database.createObjectStore('categories', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains('pending_mutations')) {
        database.createObjectStore('pending_mutations', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
  return _dbPromise
}

/** Fetch all records in a store. */
export async function idbGetAll<T>(store: 'tasks' | 'categories' | 'pending_mutations'): Promise<T[]> {
  return (await db()).getAll(store) as Promise<T[]>
}

export async function idbGet<T>(store: 'meta', key: string): Promise<T | undefined> {
  const row = await (await db()).get(store, key)
  return row?.value as T | undefined
}

export async function idbPutMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', { key, value })
}

export async function idbPutTasks(tasks: Task[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('tasks', 'readwrite')
  await tx.objectStore('tasks').clear()
  for (const t of tasks) await tx.objectStore('tasks').put(t)
  await tx.done
}

export async function idbUpsertTask(task: Task): Promise<void> {
  await (await db()).put('tasks', task)
}

export async function idbDeleteTask(id: number): Promise<void> {
  await (await db()).delete('tasks', id)
}

export async function idbPutCategories(categories: Category[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('categories', 'readwrite')
  await tx.objectStore('categories').clear()
  for (const c of categories) await tx.objectStore('categories').put(c)
  await tx.done
}

export async function idbUpsertCategory(category: Category): Promise<void> {
  await (await db()).put('categories', category)
}

export async function idbDeleteCategory(id: number): Promise<void> {
  await (await db()).delete('categories', id)
}

/** Append a mutation to the queue; returns its assigned id. */
export async function idbPushMutation(m: Omit<PendingMutation, 'id'>): Promise<number> {
  const d = await db()
  return Number(await d.add('pending_mutations', m))
}

export async function idbListMutations(): Promise<PendingMutation[]> {
  return (await db()).getAll('pending_mutations') as Promise<PendingMutation[]>
}

export async function idbUpdateMutation(m: PendingMutation): Promise<void> {
  if (m.id === undefined) throw new Error('cannot update mutation without id')
  await (await db()).put('pending_mutations', m)
}

export async function idbRemoveMutation(id: number): Promise<void> {
  await (await db()).delete('pending_mutations', id)
}

/** Subtasks live inline on tasks in the IDB cache; no dedicated store. */
export type { Task, Subtask, Category }
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/idb.ts
git commit -m "feat(todos): add IndexedDB wrapper (tasks, categories, meta, pending_mutations)"
```

---

### Task 5: `useOnline` composable

**Files:**
- Create: `app/composables/useOnline.ts`

- [ ] **Step 1: Write `app/composables/useOnline.ts`**

```ts
// app/composables/useOnline.ts — reactive navigator.onLine.
import { ref, onBeforeUnmount } from 'vue'

const online = ref<boolean>(true)
let listenerAttached = false

function attachListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  online.value = window.navigator.onLine
  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))
}

export function useOnline() {
  attachListener()
  return { online }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useOnline.ts
git commit -m "feat(todos): add useOnline composable"
```

---

### Task 6: `useSyncQueue` — enqueue + flush + retry

**Files:**
- Create: `app/composables/useSyncQueue.ts`

This is the main-thread flush loop. It does not own mutations — each mutation is enqueued by the `useTasks` / `useCategories` composables and replayed from here. The queue is persistent (IndexedDB) so pending mutations survive reloads.

- [ ] **Step 1: Write `app/composables/useSyncQueue.ts`**

```ts
// app/composables/useSyncQueue.ts — persistent mutation queue + flush loop.
import { ref, computed } from 'vue'
import { apiFetch } from '~/utils/apiFetch'
import {
  idbListMutations, idbPushMutation, idbRemoveMutation, idbUpdateMutation,
  type PendingMutation,
} from '~/utils/idb'

/** Hooks consumed by the queue to reconcile server responses back into reactive stores. */
export interface SyncHooks {
  /** Called when a task create/update/complete/uncomplete response comes back. */
  onTaskResponse?: (task: any) => void
  /** Called when a subtask create/patch/toggle response comes back. */
  onSubtaskResponse?: (subtask: any) => void
  /** Called when a category create/update response comes back. */
  onCategoryResponse?: (category: any) => void
  /** Called when a task was successfully deleted on the server. */
  onTaskDeleted?: (id: number) => void
  /** Called when a subtask was successfully deleted on the server. */
  onSubtaskDeleted?: (id: number) => void
  /** Called when a category was successfully deleted on the server. */
  onCategoryDeleted?: (id: number) => void
}

/** Max send attempts before a mutation is marked dead. */
const MAX_RETRIES = 5
/** Back-off schedule in ms for attempt N (1-indexed). */
const BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 120_000]

const pending = ref<PendingMutation[]>([])
const flushing = ref(false)
const lastSyncAt = ref<number>(0)
const deadCount = ref<number>(0)
let hooks: SyncHooks = {}
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Status derived from queue state + network. */
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'failed'

function reconcileResponse(m: PendingMutation, data: any) {
  // Work out what kind of response we got, based on the URL + method.
  if (m.url.startsWith('/api/tasks/') && m.url.endsWith('/complete')) {
    hooks.onTaskResponse?.({ id: Number(m.url.split('/')[3]), completed_at: data.completed_at, updated_at: data.updated_at })
    return
  }
  if (m.url.startsWith('/api/tasks/') && m.url.endsWith('/uncomplete')) {
    hooks.onTaskResponse?.({ id: Number(m.url.split('/')[3]), completed_at: data.completed_at, updated_at: data.updated_at })
    return
  }
  if (m.url.startsWith('/api/subtasks/') && m.url.endsWith('/toggle')) {
    if (data?.subtask) hooks.onSubtaskResponse?.(data.subtask)
    return
  }
  if (data?.task) { hooks.onTaskResponse?.(data.task); return }
  if (data?.subtask) { hooks.onSubtaskResponse?.(data.subtask); return }
  if (data?.category) { hooks.onCategoryResponse?.(data.category); return }
}

function reconcileDelete(m: PendingMutation) {
  const parts = m.url.split('/').filter(Boolean)  // ['api', 'tasks', '42']
  const kind = parts[1]
  const id = Number(parts[2])
  if (!Number.isFinite(id)) return
  if (kind === 'tasks')      hooks.onTaskDeleted?.(id)
  else if (kind === 'subtasks') hooks.onSubtaskDeleted?.(id)
  else if (kind === 'categories') hooks.onCategoryDeleted?.(id)
}

async function trySendOne(m: PendingMutation): Promise<'ok' | 'retry' | 'dead'> {
  try {
    const res = await apiFetch<any>(m.url, {
      method: m.method,
      body: m.method === 'DELETE' ? undefined : m.body,
    })
    if (m.method === 'DELETE') reconcileDelete(m)
    else reconcileResponse(m, res)
    lastSyncAt.value = Date.now()
    return 'ok'
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status
    // 4xx (except 429/408) are not retryable — the mutation is malformed or conflicts.
    if (status && status >= 400 && status < 500 && status !== 429 && status !== 408) {
      return 'dead'
    }
    return 'retry'
  }
}

async function flush() {
  if (flushing.value) return
  flushing.value = true
  try {
    pending.value = await idbListMutations()
    // Send in insertion order; stop at the first retryable failure to preserve
    // ordering (e.g. CREATE-then-COMPLETE must not swap).
    const sorted = pending.value.slice().sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    for (const m of sorted) {
      const outcome = await trySendOne(m)
      if (outcome === 'ok') {
        if (m.id !== undefined) await idbRemoveMutation(m.id)
      } else if (outcome === 'dead') {
        if (m.id !== undefined) await idbRemoveMutation(m.id)
        deadCount.value += 1
      } else {
        // retry — bump attempt count, schedule a back-off flush, stop the loop.
        const next = { ...m, retries: m.retries + 1 }
        if (next.retries >= MAX_RETRIES) {
          if (m.id !== undefined) await idbRemoveMutation(m.id)
          deadCount.value += 1
        } else {
          await idbUpdateMutation(next)
          const delay = BACKOFF_MS[Math.min(next.retries - 1, BACKOFF_MS.length - 1)]
          if (flushTimer) clearTimeout(flushTimer)
          flushTimer = setTimeout(() => { flushTimer = null; void flush() }, delay)
        }
        break
      }
    }
    pending.value = await idbListMutations()
  } finally {
    flushing.value = false
  }
}

export function useSyncQueue() {
  const status = computed<SyncStatus>(() => {
    if (deadCount.value > 0) return 'failed'
    if (pending.value.length > 0) return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending'
    return 'synced'
  })

  function setHooks(h: SyncHooks) { hooks = { ...hooks, ...h } }

  /** Enqueue a mutation. Returns the storage id. */
  async function enqueue(m: Omit<PendingMutation, 'id' | 'retries' | 'createdAt'>): Promise<number> {
    const row: Omit<PendingMutation, 'id'> = { ...m, retries: 0, createdAt: Date.now() }
    const id = await idbPushMutation(row)
    pending.value = await idbListMutations()
    // Opportunistic flush; no-op if offline/already flushing.
    void flush()
    return id
  }

  async function refreshFromStorage() {
    pending.value = await idbListMutations()
  }

  async function manualFlush() {
    deadCount.value = 0
    await flush()
  }

  return { pending, flushing, lastSyncAt, deadCount, status, setHooks, enqueue, flush, manualFlush, refreshFromStorage }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useSyncQueue.ts
git commit -m "feat(todos): add useSyncQueue composable with persistent IndexedDB queue"
```

---

### Task 7: Integrate cache + queue into `useCategories`

**Files:**
- Modify: `app/composables/useCategories.ts`

Hydrate from IDB on boot (so first paint after reload is instant even offline), persist every fetch, and enqueue mutations that fail the network path.

- [ ] **Step 1: Replace `app/composables/useCategories.ts` with this updated version**

```ts
// app/composables/useCategories.ts — fetch + IDB-cache + queue CRUD for categories.
import { ref, computed } from 'vue'
import { apiFetch } from '~/utils/apiFetch'
import {
  idbGetAll, idbPutCategories, idbUpsertCategory, idbDeleteCategory,
} from '~/utils/idb'
import { useSyncQueue } from '~/composables/useSyncQueue'

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

function sortCats(arr: Category[]): Category[] {
  return arr.slice().sort((a, b) => a.position - b.position || a.created_at - b.created_at)
}

export function useCategories() {
  const queue = useSyncQueue()
  const byId = computed(() => {
    const m = new Map<number, Category>()
    for (const c of categories.value) m.set(c.id, c)
    return m
  })

  /** Read the IDB cache into memory. Safe to call before any network attempt. */
  async function hydrate(): Promise<void> {
    const cached = await idbGetAll<Category>('categories')
    if (cached.length > 0) {
      categories.value = sortCats(cached)
      loaded.value = true
    }
  }

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      const res = await apiFetch<{ categories: Category[] }>('/api/categories')
      categories.value = sortCats(res.categories)
      await idbPutCategories(categories.value)
      loaded.value = true
    } catch (e: any) {
      // Offline or error — keep whatever we already have in memory/IDB.
      if (!loaded.value) await hydrate()
    } finally {
      loading.value = false
    }
  }

  async function create(input: { name: string; color: string; position?: number }): Promise<void> {
    // Categories don't have client_id, so optimistic creates are harder — fall back
    // to "create online, queue offline" with a tombstone client-side optimistic row
    // resolved only when the server responds. Simpler: let the queue handle it and
    // retry; the UI updates once reconciled.
    const body = input
    try {
      const res = await apiFetch<{ category: Category }>('/api/categories', { method: 'POST', body })
      categories.value = sortCats([...categories.value, res.category])
      await idbUpsertCategory(res.category)
    } catch {
      await queue.enqueue({ url: '/api/categories', method: 'POST', body })
    }
  }

  async function update(id: number, patch: Partial<Pick<Category, 'name' | 'color' | 'position'>>): Promise<void> {
    const prev = categories.value.find(c => c.id === id)
    if (!prev) return
    const optimistic: Category = { ...prev, ...patch, updated_at: Math.floor(Date.now() / 1000) }
    categories.value = sortCats(categories.value.map(c => (c.id === id ? optimistic : c)))
    await idbUpsertCategory(optimistic)
    try {
      const res = await apiFetch<{ category: Category }>(`/api/categories/${id}`, { method: 'PATCH', body: patch })
      categories.value = sortCats(categories.value.map(c => (c.id === id ? res.category : c)))
      await idbUpsertCategory(res.category)
    } catch {
      await queue.enqueue({ url: `/api/categories/${id}`, method: 'PATCH', body: patch })
    }
  }

  async function remove(id: number): Promise<void> {
    const prev = categories.value.find(c => c.id === id) ?? null
    categories.value = categories.value.filter(c => c.id !== id)
    await idbDeleteCategory(id)
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE' })
    } catch {
      await queue.enqueue({ url: `/api/categories/${id}`, method: 'DELETE' })
      // Keep the optimistic removal; queue will either confirm or eventually surface failure.
    }
  }

  // Reconciliation hooks for the sync queue — called when queued mutations flush.
  queue.setHooks({
    onCategoryResponse(category: Category) {
      categories.value = sortCats(categories.value.filter(c => c.id !== category.id).concat(category))
      void idbUpsertCategory(category)
    },
    onCategoryDeleted(id: number) {
      categories.value = categories.value.filter(c => c.id !== id)
      void idbDeleteCategory(id)
    },
  })

  return { categories, loaded, loading, byId, hydrate, refresh, create, update, remove }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useCategories.ts
git commit -m "feat(todos): useCategories reads IDB cache, enqueues offline mutations"
```

---

### Task 8: Integrate cache + queue into `useTasks`

**Files:**
- Modify: `app/composables/useTasks.ts`

Biggest change in the plan. Adds IDB hydrate + persist plus offline queueing for every mutation path. Keeps the public API (`create`, `update`, `destroy`, `complete`, `uncomplete`, `addSubtask`, `updateSubtask`, `deleteSubtask`, `toggleSubtask`, `projection`, `refresh`) so no page/component changes are needed downstream.

- [ ] **Step 1: Replace `app/composables/useTasks.ts` with this updated version**

```ts
// app/composables/useTasks.ts — IDB-cached, queue-aware task store.
import { ref, computed, type ComputedRef } from 'vue'
import { apiFetch } from '~/utils/apiFetch'
import { clientId as makeClientId } from '~/utils/clientId'
import { startOfToday, startOfTomorrow, startOfNextWeek } from '~/utils/date'
import {
  idbGetAll, idbPutTasks, idbUpsertTask, idbDeleteTask,
} from '~/utils/idb'
import { useSyncQueue } from '~/composables/useSyncQueue'

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

function upsertInMemory(t: Task) {
  const i = tasks.value.findIndex(x => x.id === t.id)
  if (i === -1) tasks.value = sortTasks([...tasks.value, t])
  else {
    const copy = tasks.value.slice()
    copy[i] = t
    tasks.value = sortTasks(copy)
  }
}

function removeInMemory(id: number) {
  tasks.value = tasks.value.filter(t => t.id !== id)
}

/** Merge an optimistic task by client_id, replacing any optimistic placeholder with the server version. */
function reconcileByClientId(server: Task) {
  // Replace optimistic row (negative temp id) with the server row.
  const i = tasks.value.findIndex(x => x.client_id === server.client_id)
  if (i !== -1) {
    const copy = tasks.value.slice()
    copy[i] = server
    tasks.value = sortTasks(copy)
  } else {
    upsertInMemory(server)
  }
}

export function useTasks() {
  const queue = useSyncQueue()

  async function hydrate(): Promise<void> {
    const cached = await idbGetAll<Task>('tasks')
    if (cached.length > 0) {
      tasks.value = sortTasks(cached)
      loaded.value = true
    }
  }

  async function refresh(view: View = 'all', categoryId: number | null = null): Promise<void> {
    loading.value = true
    try {
      const params = new URLSearchParams({ view })
      if (categoryId !== null) params.set('category_id', String(categoryId))
      const res = await apiFetch<{ tasks: Task[]; deleted_ids: { task: number[]; subtask: number[] }; now: number }>(
        `/api/tasks?${params.toString()}`,
      )
      tasks.value = sortTasks(res.tasks)
      await idbPutTasks(tasks.value)
      lastSyncAt.value = res.now
      loaded.value = true
    } catch {
      if (!loaded.value) await hydrate()
    } finally {
      loading.value = false
    }
  }

  /** Optimistic create — assigns a temp negative id; reconcileByClientId replaces on success. */
  async function create(input: {
    title: string
    notes?: string
    category_id?: number | null
    priority?: number
    due_at?: number | null
    subtasks?: { title: string; position?: number }[]
  }): Promise<Task> {
    const cid = makeClientId()
    const subtaskDrafts = (input.subtasks ?? []).map((s, i) => ({
      client_id: makeClientId(),
      title: s.title,
      position: s.position ?? i,
    }))
    const now = Math.floor(Date.now() / 1000)
    const tempId = -Math.floor(Math.random() * 1_000_000) - 1  // negative = optimistic
    const optimistic: Task = {
      id: tempId,
      category_id: input.category_id ?? null,
      title: input.title,
      notes: input.notes ?? null,
      priority: input.priority ?? 2,
      due_at: input.due_at ?? null,
      completed_at: null,
      position: 0,
      client_id: cid,
      created_at: now,
      updated_at: now,
      subtasks: subtaskDrafts.map((s, i) => ({
        id: tempId * 100 - i,
        task_id: tempId,
        title: s.title,
        completed_at: null,
        position: s.position,
        client_id: s.client_id,
        created_at: now,
        updated_at: now,
      })),
    }
    upsertInMemory(optimistic)
    await idbUpsertTask(optimistic)

    const body = {
      client_id: cid,
      title: input.title,
      notes: input.notes,
      category_id: input.category_id ?? undefined,
      priority: input.priority ?? 2,
      due_at: input.due_at ?? undefined,
      subtasks: subtaskDrafts,
    }
    try {
      const res = await apiFetch<{ task: Task }>('/api/tasks', { method: 'POST', body })
      // Remove the optimistic placeholder, upsert the real row.
      tasks.value = tasks.value.filter(t => t.id !== tempId)
      upsertInMemory(res.task)
      await idbDeleteTask(tempId)
      await idbUpsertTask(res.task)
      return res.task
    } catch {
      await queue.enqueue({ url: '/api/tasks', method: 'POST', body, clientId: cid })
      return optimistic
    }
  }

  async function update(id: number, patch: Partial<Pick<Task, 'title' | 'notes' | 'category_id' | 'priority' | 'due_at' | 'position'>>): Promise<void> {
    const prev = tasks.value.find(t => t.id === id)
    if (!prev) return
    const optimistic: Task = {
      ...prev,
      ...patch,
      updated_at: Math.floor(Date.now() / 1000),
    } as Task
    upsertInMemory(optimistic)
    await idbUpsertTask(optimistic)
    try {
      const res = await apiFetch<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: patch })
      upsertInMemory(res.task)
      await idbUpsertTask(res.task)
    } catch {
      await queue.enqueue({ url: `/api/tasks/${id}`, method: 'PATCH', body: patch })
    }
  }

  async function destroy(id: number): Promise<void> {
    const prev = tasks.value.find(t => t.id === id) ?? null
    removeInMemory(id)
    await idbDeleteTask(id)
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch {
      await queue.enqueue({ url: `/api/tasks/${id}`, method: 'DELETE' })
    }
  }

  async function complete(id: number): Promise<void> {
    const prev = tasks.value.find(t => t.id === id)
    if (!prev) return
    const now = Math.floor(Date.now() / 1000)
    const optimistic: Task = { ...prev, completed_at: now, updated_at: now }
    upsertInMemory(optimistic)
    await idbUpsertTask(optimistic)
    try {
      const res = await apiFetch<{ id: number; completed_at: number; updated_at: number }>(
        `/api/tasks/${id}/complete`, { method: 'POST' },
      )
      const final = { ...optimistic, completed_at: res.completed_at, updated_at: res.updated_at }
      upsertInMemory(final)
      await idbUpsertTask(final)
    } catch {
      await queue.enqueue({ url: `/api/tasks/${id}/complete`, method: 'POST' })
    }
  }

  async function uncomplete(id: number): Promise<void> {
    const prev = tasks.value.find(t => t.id === id)
    if (!prev) return
    const now = Math.floor(Date.now() / 1000)
    const optimistic: Task = { ...prev, completed_at: null, updated_at: now }
    upsertInMemory(optimistic)
    await idbUpsertTask(optimistic)
    try {
      const res = await apiFetch<{ id: number; completed_at: number | null; updated_at: number }>(
        `/api/tasks/${id}/uncomplete`, { method: 'POST' },
      )
      const final = { ...optimistic, completed_at: res.completed_at, updated_at: res.updated_at }
      upsertInMemory(final)
      await idbUpsertTask(final)
    } catch {
      await queue.enqueue({ url: `/api/tasks/${id}/uncomplete`, method: 'POST' })
    }
  }

  async function addSubtask(taskId: number, title: string, position = 0): Promise<void> {
    const parent = tasks.value.find(t => t.id === taskId)
    if (!parent) return
    const cid = makeClientId()
    const now = Math.floor(Date.now() / 1000)
    const tempId = -Math.floor(Math.random() * 1_000_000) - 1
    const optimisticSub: Subtask = {
      id: tempId, task_id: taskId, title, completed_at: null, position,
      client_id: cid, created_at: now, updated_at: now,
    }
    const next: Task = { ...parent, subtasks: [...parent.subtasks, optimisticSub] }
    upsertInMemory(next)
    await idbUpsertTask(next)
    const body = { client_id: cid, title, position }
    try {
      const res = await apiFetch<{ subtask: Subtask }>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body })
      const reconciled: Task = {
        ...next,
        subtasks: next.subtasks.map(s => (s.id === tempId ? res.subtask : s)),
      }
      upsertInMemory(reconciled)
      await idbUpsertTask(reconciled)
    } catch {
      await queue.enqueue({ url: `/api/tasks/${taskId}/subtasks`, method: 'POST', body, clientId: cid })
    }
  }

  async function updateSubtask(id: number, patch: Partial<Pick<Subtask, 'title' | 'position' | 'completed_at'>>): Promise<void> {
    const parent = tasks.value.find(t => t.subtasks.some(s => s.id === id))
    if (!parent) return
    const optimisticSubs = parent.subtasks.map(s => s.id === id ? { ...s, ...patch, updated_at: Math.floor(Date.now() / 1000) } : s)
    const next: Task = { ...parent, subtasks: optimisticSubs }
    upsertInMemory(next)
    await idbUpsertTask(next)
    try {
      const res = await apiFetch<{ subtask: Subtask }>(`/api/subtasks/${id}`, { method: 'PATCH', body: patch })
      const reconciled: Task = {
        ...next,
        subtasks: next.subtasks.map(s => s.id === id ? res.subtask : s),
      }
      upsertInMemory(reconciled)
      await idbUpsertTask(reconciled)
    } catch {
      await queue.enqueue({ url: `/api/subtasks/${id}`, method: 'PATCH', body: patch })
    }
  }

  async function deleteSubtask(id: number): Promise<void> {
    const parent = tasks.value.find(t => t.subtasks.some(s => s.id === id))
    if (!parent) return
    const next: Task = { ...parent, subtasks: parent.subtasks.filter(s => s.id !== id) }
    upsertInMemory(next)
    await idbUpsertTask(next)
    try {
      await apiFetch(`/api/subtasks/${id}`, { method: 'DELETE' })
    } catch {
      await queue.enqueue({ url: `/api/subtasks/${id}`, method: 'DELETE' })
    }
  }

  async function toggleSubtask(id: number): Promise<void> {
    const parent = tasks.value.find(t => t.subtasks.some(s => s.id === id))
    if (!parent) return
    const now = Math.floor(Date.now() / 1000)
    const optimisticSubs = parent.subtasks.map(s => {
      if (s.id !== id) return s
      return { ...s, completed_at: s.completed_at === null ? now : null, updated_at: now }
    })
    const next: Task = { ...parent, subtasks: optimisticSubs }
    upsertInMemory(next)
    await idbUpsertTask(next)
    try {
      const res = await apiFetch<{ subtask: Subtask }>(`/api/subtasks/${id}/toggle`, { method: 'POST' })
      const reconciled: Task = {
        ...next,
        subtasks: next.subtasks.map(s => s.id === id ? res.subtask : s),
      }
      upsertInMemory(reconciled)
      await idbUpsertTask(reconciled)
    } catch {
      await queue.enqueue({ url: `/api/subtasks/${id}/toggle`, method: 'POST' })
    }
  }

  function projection(view: View, categoryId: number | null): ComputedRef<Task[]> {
    return computed(() => {
      const today = startOfToday()
      const tomorrow = startOfTomorrow()
      const nextWeek = startOfNextWeek()
      return tasks.value.filter(t => {
        if (categoryId !== null && t.category_id !== categoryId) return false
        if (t.completed_at !== null && t.completed_at < today) return false
        if (view === 'today')   return t.due_at === null || t.due_at < tomorrow
        if (view === 'overdue') return t.completed_at === null && t.due_at !== null && t.due_at < today
        if (view === 'week')    return t.due_at === null || t.due_at < nextWeek
        return true
      })
    })
  }

  // Register sync-queue reconciliation hooks (called when the queue flushes).
  queue.setHooks({
    onTaskResponse(taskLike: any) {
      if (typeof taskLike?.completed_at !== 'undefined' && typeof taskLike.title === 'undefined') {
        // Partial response from /complete or /uncomplete — merge into existing row.
        const existing = tasks.value.find(x => x.id === taskLike.id)
        if (existing) upsertInMemory({ ...existing, completed_at: taskLike.completed_at ?? null, updated_at: taskLike.updated_at })
        return
      }
      // Full task DTO.
      if (taskLike.client_id) reconcileByClientId(taskLike as Task)
      else upsertInMemory(taskLike as Task)
      void idbUpsertTask(taskLike as Task)
    },
    onSubtaskResponse(sub: Subtask) {
      const parent = tasks.value.find(t => t.id === sub.task_id)
      if (!parent) return
      const i = parent.subtasks.findIndex(s => s.id === sub.id || s.client_id === sub.client_id)
      const nextSubs = i === -1 ? [...parent.subtasks, sub] : parent.subtasks.map((s, idx) => idx === i ? sub : s)
      const next: Task = { ...parent, subtasks: nextSubs }
      upsertInMemory(next)
      void idbUpsertTask(next)
    },
    onTaskDeleted(id: number) {
      removeInMemory(id)
      void idbDeleteTask(id)
    },
    onSubtaskDeleted(id: number) {
      const parent = tasks.value.find(t => t.subtasks.some(s => s.id === id))
      if (!parent) return
      const next: Task = { ...parent, subtasks: parent.subtasks.filter(s => s.id !== id) }
      upsertInMemory(next)
      void idbUpsertTask(next)
    },
  })

  return {
    tasks, loaded, loading, lastSyncAt,
    hydrate, refresh,
    create, update, destroy, complete, uncomplete,
    addSubtask, updateSubtask, deleteSubtask, toggleSubtask,
    projection,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useTasks.ts
git commit -m "feat(todos): useTasks reads IDB cache, enqueues offline mutations, optimistic CRUD"
```

---

### Task 9: Boot-time IDB hydrate + flush on online/visibility

**Files:**
- Create: `app/plugins/pwa.client.ts`
- Modify: `app/pages/todos/index.vue`

The Nuxt plugin wires the queue's flush triggers and hydrates the stores from IDB before the first render tries to hit the network. Runs client-only.

- [ ] **Step 1: Write `app/plugins/pwa.client.ts`**

```ts
// app/plugins/pwa.client.ts — boot-time wiring for the offline sync layer.
import { defineNuxtPlugin } from '#app'
import { useCategories } from '~/composables/useCategories'
import { useTasks } from '~/composables/useTasks'
import { useSyncQueue } from '~/composables/useSyncQueue'
import { useOnline } from '~/composables/useOnline'

export default defineNuxtPlugin(async () => {
  // Instantiate composables early so their reconciliation hooks register.
  const cats = useCategories()
  const tasks = useTasks()
  const queue = useSyncQueue()
  useOnline()

  // Hydrate from IDB so the first render is instant (especially after reload / offline).
  await Promise.all([cats.hydrate(), tasks.hydrate(), queue.refreshFromStorage()])

  // Flush triggers.
  window.addEventListener('online', () => { void queue.flush() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void queue.flush()
  })
})
```

- [ ] **Step 2: Update `app/pages/todos/index.vue` — change `onMounted` to also hydrate**

Find the `onMounted` block (near the top of the `<script setup>`, around line 40). Replace the existing body:

```vue
onMounted(async () => {
  await Promise.all([
    categoriesStore.refresh(),
    tasksStore.refresh('all'),
  ])
  // ... manifest shortcut logic stays unchanged
```

with:

```vue
onMounted(async () => {
  // IDB hydrate already happened in app/plugins/pwa.client.ts. Refresh in background
  // without blocking first paint; if offline, these reject silently and we keep
  // showing cached data.
  void categoriesStore.refresh()
  void tasksStore.refresh('all')
  // ... manifest shortcut logic stays unchanged
```

Keep the `if (route.query.new === '1')` block below it exactly as it is.

- [ ] **Step 3: Verify**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npx nuxi prepare
```

Expected: `Types generated in .nuxt.`

- [ ] **Step 4: Commit**

```bash
git add app/plugins/pwa.client.ts app/pages/todos/index.vue
git commit -m "feat(todos): boot-time IDB hydrate + flush on online/visibility"
```

---

### Task 10: `SyncIndicator` component

**Files:**
- Create: `app/components/Todo/SyncIndicator.vue`
- Modify: `app/components/Todo/Sidebar.vue` (footer slot)

- [ ] **Step 1: Write `app/components/Todo/SyncIndicator.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSyncQueue, type SyncStatus } from '~/composables/useSyncQueue'
import { useOnline } from '~/composables/useOnline'

const { status, pending, manualFlush, deadCount } = useSyncQueue()
const { online } = useOnline()

const effective = computed<SyncStatus>(() => {
  if (!online.value && pending.value.length > 0) return 'offline'
  return status.value
})

const label = computed(() => {
  switch (effective.value) {
    case 'synced':  return 'Synced'
    case 'pending': return `Syncing ${pending.value.length}…`
    case 'offline': return `Offline · ${pending.value.length} pending`
    case 'failed':  return `Sync failed · ${deadCount.value}`
  }
  return ''
})

const dotClass = computed(() => {
  switch (effective.value) {
    case 'synced':  return 'bg-emerald-600'
    case 'pending': return 'bg-amber-500'
    case 'offline': return 'bg-ink-faint'
    case 'failed':  return 'bg-red-600'
  }
  return 'bg-ink-faint'
})
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 text-[0.72rem] text-ink-muted hover:text-ink px-2 py-1 rounded"
    :title="effective === 'failed' ? 'Tap to retry' : 'Tap to force sync now'"
    @click="manualFlush"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full" :class="dotClass" />
    <span>{{ label }}</span>
  </button>
</template>
```

- [ ] **Step 2: Add it to the Sidebar footer**

Edit `app/components/Todo/Sidebar.vue`. At the bottom of the `<aside>` block (after the last category `<button>` + "New category" NuxtLink), add:

```vue
    <div class="mt-auto pt-3 border-t border-ink-faint/10 px-1">
      <SyncIndicator />
    </div>
```

And at the top of the `<script setup>` block, add:

```ts
import SyncIndicator from '~/components/Todo/SyncIndicator.vue'
```

Also add `h-full flex flex-col` to the aside's existing class list so `mt-auto` works. Find the existing `<aside class="hidden lg:flex flex-col w-[240px] ...">` — it already has `flex flex-col`, so `mt-auto` on the footer will push it to the bottom.

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/SyncIndicator.vue app/components/Todo/Sidebar.vue
git commit -m "feat(todos): SyncIndicator in desktop sidebar footer"
```

---

### Task 11: `OfflineBanner` component

**Files:**
- Create: `app/components/Todo/OfflineBanner.vue`
- Modify: `app/pages/todos/index.vue`

- [ ] **Step 1: Write `app/components/Todo/OfflineBanner.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOnline } from '~/composables/useOnline'
import { useSyncQueue } from '~/composables/useSyncQueue'

const { online } = useOnline()
const { pending } = useSyncQueue()

const show = computed(() => !online.value)
const label = computed(() => {
  if (pending.value.length === 0) return 'Offline — your changes will sync when you reconnect.'
  return `Offline — ${pending.value.length} change${pending.value.length === 1 ? '' : 's'} pending sync.`
})
</script>

<template>
  <Transition name="banner">
    <div
      v-if="show"
      class="px-4 py-1.5 text-xs text-ink-muted bg-surface-raised/70 border-b border-ink-faint/10 flex items-center gap-2"
      role="status"
    >
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
      </svg>
      {{ label }}
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active, .banner-leave-active { transition: opacity 0.15s; }
.banner-enter-from, .banner-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 2: Mount it in `app/pages/todos/index.vue`**

Below the `<header>` element but above `<QuickAdd>`, insert:

```vue
        <OfflineBanner />
```

And at the top of the `<script setup>`, add:

```ts
import OfflineBanner from '~/components/Todo/OfflineBanner.vue'
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/OfflineBanner.vue app/pages/todos/index.vue
git commit -m "feat(todos): OfflineBanner shows offline state above task list"
```

---

### Task 12: `InstallHint` — Android deferred prompt + iOS hint

**Files:**
- Create: `app/components/Todo/InstallHint.vue`
- Modify: `app/pages/todos/index.vue`

- [ ] **Step 1: Write `app/components/Todo/InstallHint.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/**
 * Install prompts for two platforms:
 *   - Android/Chrome: capture `beforeinstallprompt`; show CTA after the user has
 *     clearly engaged (we gate on a `completedCount` hint from the parent).
 *   - iOS Safari: no install event. UA-detect and show a one-time "share → Add
 *     to Home Screen" hint.
 * Dismissal is persisted in localStorage so we never nag.
 */

const props = defineProps<{ engagementHit?: boolean }>()

const DISMISS_KEY = 'alola_install_dismissed_v1'
const dismissed = ref<boolean>(false)
const deferred = ref<any>(null)
const isIOS = ref<boolean>(false)
const isStandalone = ref<boolean>(false)

onMounted(() => {
  if (typeof window === 'undefined') return
  dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
  // iOS Safari detection (rough; no proper beforeinstallprompt on iOS).
  const ua = navigator.userAgent
  isIOS.value = /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  // Already installed?
  isStandalone.value = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as any).standalone === true

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    deferred.value = e
  })
})

const show = computed(() => {
  if (dismissed.value || isStandalone.value) return false
  if (!props.engagementHit) return false
  return deferred.value !== null || isIOS.value
})

function dismiss() {
  dismissed.value = true
  try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
}

async function install() {
  if (!deferred.value) return
  deferred.value.prompt()
  const { outcome } = await deferred.value.userChoice
  deferred.value = null
  if (outcome !== 'accepted') dismiss()
  else dismiss()  // either way, stop nagging
}
</script>

<template>
  <Transition name="hint">
    <div
      v-if="show"
      class="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[92%] bg-surface-raised border border-ink-faint/15 rounded-xl px-3 py-2 shadow-xl flex items-center gap-3 text-sm"
      role="status"
    >
      <template v-if="deferred">
        <span class="text-ink">Install alola todos?</span>
        <button type="button" class="text-accent-light font-semibold" @click="install">Install</button>
      </template>
      <template v-else>
        <span class="text-ink-muted text-xs leading-snug">
          Tap <span class="inline-block align-middle">⎋</span> then <strong class="text-ink">Add to Home Screen</strong>.
        </span>
      </template>
      <button type="button" class="text-ink-faint px-1" aria-label="Dismiss" @click="dismiss">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.hint-enter-active, .hint-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hint-enter-from, .hint-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
```

- [ ] **Step 2: Mount in `app/pages/todos/index.vue`**

Near the bottom of the template (after `<Snackbar />`), add:

```vue
    <InstallHint :engagement-hit="completedCount >= 3" />
```

In `<script setup>`, add imports + the counter:

```ts
import InstallHint from '~/components/Todo/InstallHint.vue'
import { computed } from 'vue'  // (already imported — skip if present)

const completedCount = computed(() => tasksStore.tasks.value.filter(t => t.completed_at !== null).length)
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Todo/InstallHint.vue app/pages/todos/index.vue
git commit -m "feat(todos): InstallHint for Android (deferred) + iOS (Add to Home Screen)"
```

---

### Task 13: Register service worker via `@vite-pwa/nuxt` (injectManifest)

**Files:**
- Modify: `nuxt.config.ts`
- Create: `public/service-worker.ts`

Use the module's `injectManifest` strategy so we own the SW source; Workbox's build step injects `self.__WB_MANIFEST` (the precache list).

- [ ] **Step 1: Update `nuxt.config.ts`**

Add `@vite-pwa/nuxt` to the modules array and configure it. Read the current `nuxt.config.ts` first, then replace the whole file with this version:

```ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
  modules: [
    '@vite-pwa/nuxt',
  ],
  css: ['~/assets/sass/main.scss'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      titleTemplate: '%s — alola.org',
      meta: [
        { name: 'description', content: 'Graeme Lawton — serial volunteer, technical nerd, hobby collector, outdoors lover.' },
        { property: 'og:site_name', content: 'alola.org' },
        { property: 'og:type', content: 'website' },
        { name: 'theme-color', content: '#141210' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    preset: 'vercel',
  },
  pwa: {
    registerType: 'autoUpdate',
    // InjectManifest: we own the service worker source; Workbox only injects precache.
    strategies: 'injectManifest',
    srcDir: 'public',
    filename: 'service-worker.ts',
    scope: '/todos/',
    // Generate sw only for /todos/ scope; the public site doesn't need a SW.
    workbox: undefined,
    injectManifest: {
      globPatterns: [
        '**/*.{js,css,html,png,svg,ico,webmanifest}',
      ],
      globIgnores: [
        'scrabble/**',  // the scrabble solver has its own assets, not worth precaching here
      ],
    },
    devOptions: {
      enabled: false,  // dev has HMR + own SW lifecycle — keep off to avoid confusion
    },
    // The manifest is served by our Nitro route (see server/api/todos/manifest.webmanifest.get.ts);
    // vite-pwa's bundled manifest is not used.
    manifest: false,
  },
  routeRules: {
    '/**': {
      headers: {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    '/todos/**': {
      headers: {
        'X-Frame-Options': 'DENY',
      },
    },
    '/api/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
      },
    },
  },
  postcss: {
    plugins: {
      'tailwindcss': {},
      'autoprefixer': {},
    },
  },
})
```

- [ ] **Step 2: Write `public/service-worker.ts`**

```ts
// public/service-worker.ts — custom SW. Workbox injects __WB_MANIFEST at build time.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Precache the app shell (JS/CSS/HTML/fonts/images).
precacheAndRoute((self as any).__WB_MANIFEST ?? [])
cleanupOutdatedCaches()

// Navigation requests to /todos/* — network-first, fall back to cached shell.
registerRoute(
  new NavigationRoute(new NetworkFirst({
    cacheName: 'todos-pages',
    networkTimeoutSeconds: 3,
  }), {
    allowlist: [/^\/todos\//],
  }),
)

// GET /api/tasks and /api/categories — stale-while-revalidate for instant reads.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname === '/api/tasks' || url.pathname === '/api/categories' || url.pathname.startsWith('/api/tasks/')),
  new StaleWhileRevalidate({
    cacheName: 'todos-api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
)

// Other GET /api/* — network-first with short timeout, no fallback (let it error).
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'todos-api-other', networkTimeoutSeconds: 3 }),
)

// Mutating requests are deliberately NOT intercepted — the main-thread queue owns them.
// We let them hit the network directly; if offline, the fetch rejects and useTasks /
// useCategories enqueue to IndexedDB.

self.addEventListener('install', () => { void (self as any).skipWaiting?.() })
self.addEventListener('activate', (event: any) => { event.waitUntil((self as any).clients.claim()) })
```

- [ ] **Step 3: Verify dev build**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npx nuxi prepare
```

Expected: Types generated. If the module throws on boot, the error will surface here — read the message and fix inline.

- [ ] **Step 4: Commit**

```bash
git add nuxt.config.ts public/service-worker.ts
git commit -m "feat(todos): service worker via @vite-pwa/nuxt injectManifest"
```

---

### Task 14: Add `workbox-*` packages as explicit dependencies

**Files:**
- Modify: `package.json`

`workbox-precaching`, `workbox-routing`, `workbox-strategies`, and `workbox-expiration` are used directly by `public/service-worker.ts`. They are pulled in transitively by `@vite-pwa/nuxt`, but some bundler configurations lose them — explicit install guarantees resolution.

- [ ] **Step 1: Install**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npm install --save-dev workbox-precaching workbox-routing workbox-strategies workbox-expiration
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(todos): explicit workbox-* devDeps for SW build"
```

---

### Task 15: Reintroduce CSP via `nuxt-security` (with nonces)

**Files:**
- Modify: `nuxt.config.ts`

We dropped the strict CSP in Plan 1 because it broke Nuxt SSR hydration (inline state scripts). `nuxt-security` adds nonces to those inline scripts and configures CSP correctly.

- [ ] **Step 1: Update `nuxt.config.ts`**

Add `nuxt-security` to the modules array and configure it. Replace the current `modules: [ '@vite-pwa/nuxt' ]` block with:

```ts
  modules: [
    'nuxt-security',
    '@vite-pwa/nuxt',
  ],
```

Add a `security` configuration block at the top level (peer of `modules`, `pwa`, `nitro`):

```ts
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'manifest-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],  // Vite HMR and the SW both need blob: in dev
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
      },
      xFrameOptions: 'DENY',
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubdomains: true,
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      xContentTypeOptions: 'nosniff',
      crossOriginResourcePolicy: 'same-origin',
      crossOriginOpenerPolicy: 'same-origin',
    },
    nonce: true,
    // Rate-limit + request-size-limit handled elsewhere (our own helpers). Disable here to avoid double-counting.
    rateLimiter: false,
    requestSizeLimiter: false,
    xssValidator: false,
    corsHandler: false,
  },
```

Remove the now-duplicate header entries from the existing `routeRules` (keep Cache-Control on `/api/**`):

```ts
  routeRules: {
    '/api/**': {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  },
```

- [ ] **Step 2: Verify**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npx nuxi prepare
npm run dev
# browse to http://localhost:3000/todos/login, sign in, verify the app boots
# (Nuxt hydration must still work — the nonce should let inline __NUXT__ scripts run)
# Ctrl+C when satisfied.
```

Expected: app mounts, login works, no CSP violations in the console.

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "feat(todos): nonce-based CSP via nuxt-security"
```

---

### Task 16: Document the offline model in a user-facing note

**Files:**
- Create: `app/pages/todos/settings/offline.vue`
- Modify: `app/pages/todos/settings/index.vue` (add link)

Small user-facing page explaining the offline behaviour — helps when things look weird (e.g. "my task I added on the tube hasn't appeared on my laptop yet").

- [ ] **Step 1: Write `app/pages/todos/settings/offline.vue`**

```vue
<script setup lang="ts">
import { definePageMeta } from '#imports'
import { useSyncQueue } from '~/composables/useSyncQueue'
import { useOnline } from '~/composables/useOnline'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Offline & sync' })

const { pending, lastSyncAt, manualFlush, status, deadCount } = useSyncQueue()
const { online } = useOnline()

function when(ts: number | null | undefined) {
  if (!ts) return 'never'
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Offline & sync</h1>
    </header>

    <section class="space-y-3">
      <p class="text-sm text-ink-muted leading-relaxed">
        Todos works offline. Your device keeps a copy of the last-seen list, and any changes you make while
        disconnected queue up here and send when you're back online. Mutations sync on reconnect and when the
        tab becomes active.
      </p>

      <div class="rounded-xl border border-ink-faint/10 divide-y divide-ink-faint/10">
        <div class="flex justify-between px-4 py-3 text-sm"><span>Network</span><span :class="online ? 'text-emerald-400' : 'text-ink-faint'">{{ online ? 'Online' : 'Offline' }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Sync status</span><span>{{ status }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Pending changes</span><span>{{ pending.length }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Last sync</span><span>{{ when(lastSyncAt) }}</span></div>
        <div v-if="deadCount" class="flex justify-between px-4 py-3 text-sm text-red-400"><span>Failed mutations</span><span>{{ deadCount }}</span></div>
      </div>

      <button type="button" class="bg-accent text-surface px-3 py-2 rounded text-sm font-semibold" @click="manualFlush">
        Sync now
      </button>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Add link to the settings hub**

In `app/pages/todos/settings/index.vue`, add a second `NuxtLink` inside the `<nav>`:

```vue
      <NuxtLink to="/todos/settings/offline" class="flex items-center justify-between px-4 py-3 hover:bg-surface-raised">
        <span>Offline & sync</span>
        <span class="text-ink-faint">›</span>
      </NuxtLink>
```

- [ ] **Step 3: Commit**

```bash
git add app/pages/todos/settings/offline.vue app/pages/todos/settings/index.vue
git commit -m "feat(todos): offline & sync settings page"
```

---

### Task 17: Prod build smoke test (local)

No new files — verify the production build works before pushing to prod.

- [ ] **Step 1: Build + preview locally**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
npm run build
npm run preview
```

- [ ] **Step 2: In DevTools, verify**

1. `http://localhost:3000/todos/login` → log in.
2. Application → Service Workers: one worker registered, `activated and running`.
3. Application → Manifest: `alola todos` with scope `/todos/`, 3 icons, 3 shortcuts.
4. Application → IndexedDB → `alola_todos`: stores `tasks`, `categories`, `meta`, `pending_mutations` all present.
5. Reload page — list paints instantly (from IDB), then re-syncs from server.
6. DevTools → Network → throttle to **Offline**. Add a task, complete it, check it appears. Sidebar SyncIndicator goes amber.
7. Turn network back on. SyncIndicator returns green within ~2s.
8. Check Application → Storage → `alola_csrf` cookie still accessible.
9. Check Console for any CSP violations — should be none.

- [ ] **Step 3: Ctrl+C the preview server when done. No commit needed.**

---

### Task 18: End-to-end smoke test on a real phone

Drive the smoke test over the network against the dev server (your phone and the dev machine need to be on the same network).

- [ ] **Step 1: Note the LAN IP of the dev machine**

```bash
hostname -I | awk '{print $1}'
```

- [ ] **Step 2: Start dev server bound to 0.0.0.0**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
# nuxt dev already binds 0.0.0.0; if not, set HOST=0.0.0.0
npm run dev
```

- [ ] **Step 3: On your phone**

1. Visit `http://<LAN_IP>:3000/todos/login`. Log in with dev creds.
2. Android Chrome: after you've completed at least 3 tasks, the "Install alola todos?" banner should appear. Tap Install.
3. iOS Safari: open share sheet → Add to Home Screen → confirm. The app icon appears on the home screen. Open it: should launch standalone (no browser chrome).
4. Airplane mode on. Open the app. Tasks still visible. Add a task — should appear immediately, with the SyncIndicator going amber.
5. Airplane mode off. Within a few seconds SyncIndicator goes green; the new task now has a real server id (visible via devtools if you care).

(If Task 18 is impractical right now, it's acceptable to defer to post-deploy since we'll test on prod anyway.)

---

### Task 19: Merge + prod deploy

- [ ] **Step 1: Confirm clean branch**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-offline-pwa
git status           # clean
git log --oneline master..HEAD | wc -l    # ~18 commits
```

- [ ] **Step 2: Merge + push from the main checkout**

```bash
cd /home/graemel/workspace/alola
git checkout master
git pull --ff-only
git merge --no-ff feat/todos-offline-pwa -m "Merge plan 3: offline + PWA"
git push origin master
```

Vercel auto-deploys. Wait 1-2 min.

- [ ] **Step 3: Verify prod**

```bash
sleep 90
curl -sI https://alola.org/todos | head -5
curl -sI https://alola.org/api/todos/manifest.webmanifest | head -5   # content-type should be application/manifest+json
```

Open `https://alola.org/todos` on your phone. Install to home screen. Go offline. Add a task. Reconnect. Verify sync.

- [ ] **Step 4: Cleanup**

```bash
cd /home/graemel/workspace/alola
git worktree remove ~/.config/superpowers/worktrees/alola/todos-offline-pwa
git branch -d feat/todos-offline-pwa
```

Plan 3 shipped.

---

## Self-review notes (author)

- **Spec coverage:** Manifest served from a scoped route (T2, T3). Service worker with precache + stale-while-revalidate for GETs + passthrough for mutations (T13). IndexedDB wrapper + snapshot cache (T4, T7, T8). Main-thread mutation queue with retries and status (T6). Optimistic updates in composables (T7, T8). Sync indicator (T10). Offline banner (T11). Install prompts — Android + iOS (T12). Nonce-based CSP (T15). User-facing sync settings (T16). Smoke tests (T17, T18). Deploy (T19). All v1 PWA items from the spec are present.
- **Explicitly deferred** (still per spec): Background Sync API, periodic background sync, push notifications. Plan 4 territory.
- **Type consistency:** `Task`, `Subtask`, `Category` types are imported from `useTasks.ts` / `useCategories.ts` throughout — single source of truth. `PendingMutation` lives in `idb.ts`; `SyncStatus` and `SyncHooks` in `useSyncQueue.ts`.
- **No placeholders.** Every step has byte-identical code or exact commands.
- **Known trade-offs:**
  - Optimistic category creates don't get a temp id (there's no `client_id` on categories in the schema). A category created while offline sits in the queue until it flushes; the UI doesn't show it until the server responds. Acceptable for the expected use pattern (categories are rarely created). If we ever want offline-first categories, Plan 4 or a schema migration can add `client_id` to categories.
  - The SW's stale-while-revalidate for `/api/tasks/*` routes includes the single-task endpoint `GET /api/tasks/:id`. The detail-view rendering uses the inline subtasks already present from the list fetch, so the single-task GET isn't on the hot path — caching it is harmless.
  - `InstallHint`'s engagement gate (`completedCount >= 3`) uses the in-memory task list. For a user arriving fresh with 0 completed tasks, the hint never appears until they complete 3 — appropriate restraint; users can still install via browser menu.
