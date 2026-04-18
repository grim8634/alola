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
