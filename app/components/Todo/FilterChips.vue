<script setup lang="ts">
import { computed } from 'vue'
import type { View } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'

const props = defineProps<{
  view: View
  categoryId: number | null
}>()
const emit = defineEmits<{
  (e: 'update:view', v: View): void
  (e: 'update:categoryId', id: number | null): void
}>()

const { categories } = useCategories()

function selectView(v: View) {
  emit('update:categoryId', null)
  emit('update:view', v)
}
function selectCategory(id: number) {
  emit('update:view', 'all')
  emit('update:categoryId', id)
}

const anyCategory = computed(() => props.categoryId !== null)
</script>

<template>
  <div class="flex gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar">
    <button type="button" class="chip" :class="{ 'chip-active': view === 'today' && !anyCategory }" @click="selectView('today')">Today</button>
    <button type="button" class="chip" :class="{ 'chip-active': view === 'all' && !anyCategory }" @click="selectView('all')">All</button>
    <button type="button" class="chip" :class="{ 'chip-active': view === 'week' && !anyCategory }" @click="selectView('week')">This week</button>
    <button
      v-for="c in categories"
      :key="c.id"
      type="button"
      class="chip"
      :class="{ 'chip-active': categoryId === c.id }"
      @click="selectCategory(c.id)"
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full" :style="{ background: c.color }" />
      {{ c.name }}
    </button>
  </div>
</template>

<style scoped>
.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
  color: theme(colors.ink.muted);
  border: 1px solid theme(colors.ink.faint / 0.2);
  background: transparent;
  white-space: nowrap;
}
.chip-active {
  background: theme(colors.accent.DEFAULT);
  border-color: theme(colors.accent.DEFAULT);
  color: theme(colors.surface.DEFAULT);
  font-weight: 600;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }
</style>
