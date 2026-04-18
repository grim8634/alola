<script setup lang="ts">
defineProps<{
  color: string
  name: string
  dense?: boolean
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap" :class="dense ? 'text-xs' : 'text-sm'">
    <span class="inline-block rounded-full" :class="dense ? 'w-1.5 h-1.5' : 'w-2 h-2'" :style="{ background: color }" />
    <span class="text-ink-muted">{{ name }}</span>
  </span>
</template>
