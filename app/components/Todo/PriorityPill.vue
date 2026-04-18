<script setup lang="ts">
defineProps<{ priority: number }>()
const labels: Record<number, string> = { 1: 'LOW', 2: 'MED', 3: 'HIGH' }
</script>

<template>
  <span
    class="flex-shrink-0 rounded text-[0.66rem] font-bold tracking-wider"
    :class="[
      'px-1.5 py-px',
      priority === 3 && 'bg-accent/20 text-accent-light',
      priority === 2 && 'bg-ink-muted/15 text-ink-muted',
      priority === 1 && 'bg-transparent text-ink-faint',
    ]"
  >{{ labels[priority] ?? '—' }}</span>
</template>
