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
