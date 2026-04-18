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
