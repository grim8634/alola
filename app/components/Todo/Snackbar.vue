<script setup lang="ts">
import { useUndoSnackbar } from '~/composables/useUndoSnackbar'
const { active, undo, dismiss } = useUndoSnackbar()
</script>

<template>
  <Transition name="snack">
    <div
      v-if="active"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-raised border border-ink-faint/15 rounded-lg px-4 py-2 shadow-xl text-sm"
      role="status"
    >
      <span class="text-ink">{{ active.message }}</span>
      <button v-if="active.onUndo" type="button" class="text-accent-light font-semibold" @click="undo">Undo</button>
      <button type="button" class="text-ink-faint px-1" @click="dismiss" aria-label="Dismiss">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.snack-enter-active, .snack-leave-active { transition: transform 0.2s, opacity 0.2s; }
.snack-enter-from, .snack-leave-to { transform: translate(-50%, 8px); opacity: 0; }
</style>
