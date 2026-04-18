// app/composables/useUndoSnackbar.ts — transient snackbar with an undo callback.
import { ref } from 'vue'

interface Snack {
  id: number
  message: string
  onUndo?: () => void | Promise<void>
  expiresAt: number
}

const active = ref<Snack | null>(null)
let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null

export function useUndoSnackbar() {
  function show(message: string, onUndo?: () => void | Promise<void>, durationMs = 6000) {
    if (timer) clearTimeout(timer)
    const id = nextId++
    active.value = { id, message, onUndo, expiresAt: Date.now() + durationMs }
    timer = setTimeout(() => {
      if (active.value?.id === id) active.value = null
    }, durationMs)
  }

  async function undo() {
    const current = active.value
    if (!current?.onUndo) return
    active.value = null
    if (timer) { clearTimeout(timer); timer = null }
    try { await current.onUndo() } catch { /* swallow — user retries */ }
  }

  function dismiss() {
    active.value = null
    if (timer) { clearTimeout(timer); timer = null }
  }

  return { active, show, undo, dismiss }
}
