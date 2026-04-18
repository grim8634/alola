<script setup lang="ts">
import { computed } from 'vue'
import { useSyncQueue, type SyncStatus } from '~/composables/useSyncQueue'
import { useOnline } from '~/composables/useOnline'

const { status, pending, manualFlush, deadCount } = useSyncQueue()
const { online } = useOnline()

const effective = computed<SyncStatus>(() => {
  if (!online.value && pending.value.length > 0) return 'offline'
  return status.value
})

const label = computed(() => {
  switch (effective.value) {
    case 'synced':  return 'Synced'
    case 'pending': return `Syncing ${pending.value.length}…`
    case 'offline': return `Offline · ${pending.value.length} pending`
    case 'failed':  return `Sync failed · ${deadCount.value}`
  }
  return ''
})

const dotClass = computed(() => {
  switch (effective.value) {
    case 'synced':  return 'bg-emerald-600'
    case 'pending': return 'bg-amber-500'
    case 'offline': return 'bg-ink-faint'
    case 'failed':  return 'bg-red-600'
  }
  return 'bg-ink-faint'
})
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 text-[0.72rem] text-ink-muted hover:text-ink px-2 py-1 rounded"
    :title="effective === 'failed' ? 'Tap to retry' : 'Tap to force sync now'"
    @click="manualFlush"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full" :class="dotClass" />
    <span>{{ label }}</span>
  </button>
</template>
