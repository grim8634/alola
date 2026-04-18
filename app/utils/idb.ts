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

/**
 * Strip Vue reactive Proxies (and any other non-cloneable wrappers) before
 * writing to IDB. IndexedDB uses the structured-clone algorithm which fails on
 * Proxy objects with `DataCloneError: [object Array] could not be cloned`.
 * JSON round-trip is crude but reliable for our plain-data task/category shapes.
 */
function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export async function idbPutTasks(tasks: Task[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('tasks', 'readwrite')
  await tx.objectStore('tasks').clear()
  for (const t of tasks) await tx.objectStore('tasks').put(plain(t))
  await tx.done
}

export async function idbUpsertTask(task: Task): Promise<void> {
  await (await db()).put('tasks', plain(task))
}

export async function idbDeleteTask(id: number): Promise<void> {
  await (await db()).delete('tasks', id)
}

export async function idbPutCategories(categories: Category[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('categories', 'readwrite')
  await tx.objectStore('categories').clear()
  for (const c of categories) await tx.objectStore('categories').put(plain(c))
  await tx.done
}

export async function idbUpsertCategory(category: Category): Promise<void> {
  await (await db()).put('categories', plain(category))
}

export async function idbDeleteCategory(id: number): Promise<void> {
  await (await db()).delete('categories', id)
}

/** Append a mutation to the queue; returns its assigned id. */
export async function idbPushMutation(m: Omit<PendingMutation, 'id'>): Promise<number> {
  const d = await db()
  return Number(await d.add('pending_mutations', plain(m)))
}

export async function idbListMutations(): Promise<PendingMutation[]> {
  return (await db()).getAll('pending_mutations') as Promise<PendingMutation[]>
}

export async function idbUpdateMutation(m: PendingMutation): Promise<void> {
  if (m.id === undefined) throw new Error('cannot update mutation without id')
  await (await db()).put('pending_mutations', plain(m))
}

export async function idbRemoveMutation(id: number): Promise<void> {
  await (await db()).delete('pending_mutations', id)
}

/** Subtasks live inline on tasks in the IDB cache; no dedicated store. */
