<script setup lang="ts">
defineProps<{ highlight?: number | null }>()

const POSITIONS = [1, 2, 3, 4, 5, 6, 7]
const px = (p: number) => 30 + (p - 1) * 40
</script>

<template>
  <svg viewBox="0 0 300 70" class="w-full max-w-md mx-auto" role="img" aria-label="Trombone slide positions 1 to 7">
    <!-- Slide tube -->
    <rect x="10" y="33" width="280" height="4" rx="2" class="fill-ink-faint/60" />
    <g v-for="p in POSITIONS" :key="p">
      <circle
        :cx="px(p)"
        cy="35"
        r="12"
        stroke-width="1.5"
        :class="p === highlight ? 'fill-accent' : 'fill-surface-raised stroke-ink-faint'"
      />
      <text
        :x="px(p)"
        y="40"
        text-anchor="middle"
        font-size="13"
        class="font-display font-semibold"
        :class="p === highlight ? 'fill-surface' : 'fill-ink-muted'"
      >{{ p }}</text>
    </g>
  </svg>
</template>
