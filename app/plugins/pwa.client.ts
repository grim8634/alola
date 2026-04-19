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

  // Flush queue + pull latest server state when we come online or back into view.
  // This is how changes made on one device show up on another: next time the
  // second device's tab becomes visible, it refetches.
  function syncNow() {
    void queue.flush()
    void cats.refresh()
    void tasks.refresh('all')
  }

  window.addEventListener('online', syncNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
  // Also refetch on window focus — covers the desktop case where the tab is
  // always visible but the window loses/regains focus.
  window.addEventListener('focus', syncNow)
})
