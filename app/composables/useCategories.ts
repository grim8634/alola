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
