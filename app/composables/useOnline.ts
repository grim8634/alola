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
