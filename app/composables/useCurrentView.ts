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
