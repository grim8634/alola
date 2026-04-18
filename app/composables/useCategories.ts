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
