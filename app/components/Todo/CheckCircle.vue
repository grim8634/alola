<script setup lang="ts">
defineProps<{
  checked: boolean
  highPriority?: boolean
  size?: 'sm' | 'md'
}>()
defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <button
    type="button"
    class="relative flex-shrink-0 rounded-full transition-colors"
    :class="[
      size === 'sm' ? 'w-[18px] h-[18px] border-[1.5px]' : 'w-[22px] h-[22px] border-[1.5px]',
      checked ? 'bg-accent border-accent' : (highPriority ? 'border-accent' : 'border-ink-faint'),
    ]"
    :aria-checked="checked"
    :aria-label="checked ? 'Mark incomplete' : 'Mark complete'"
    role="checkbox"
    @click.stop="$emit('toggle')"
  >
    <svg v-if="checked" viewBox="0 0 24 24" class="absolute inset-0 m-auto" :class="size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'">
      <path d="M5 12l5 5L20 7" fill="none" stroke="#141210" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
