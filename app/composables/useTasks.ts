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
