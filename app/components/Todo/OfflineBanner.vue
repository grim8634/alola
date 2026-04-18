<script setup lang="ts">
import { computed } from 'vue'
import { useOnline } from '~/composables/useOnline'
import { useSyncQueue } from '~/composables/useSyncQueue'

const { online } = useOnline()
const { pending } = useSyncQueue()

const show = computed(() => !online.value)
const label = computed(() => {
  if (pending.value.length === 0) return 'Offline — your changes will sync when you reconnect.'
  return `Offline — ${pending.value.length} change${pending.value.length === 1 ? '' : 's'} pending sync.`
})
</script>

<template>
  <Transition name="banner">
    <div
      v-if="show"
      class="px-4 py-1.5 text-xs text-ink-muted bg-surface-raised/70 border-b border-ink-faint/10 flex items-center gap-2"
      role="status"
    >
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
      </svg>
      {{ label }}
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active, .banner-leave-active { transition: opacity 0.15s; }
.banner-enter-from, .banner-leave-to { opacity: 0; }
</style>
