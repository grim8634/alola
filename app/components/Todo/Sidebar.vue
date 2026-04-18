<script setup lang="ts">
import type { View } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'

defineProps<{
  view: View
  categoryId: number | null
  counts: {
    today: number
    overdue: number
    all: number
    week: number
    byCategory: Record<number, number>
  }
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
</script>

<template>
  <aside class="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-ink-faint/10 bg-black/20 px-2 py-5 gap-5">
    <div class="px-3">
      <div class="font-display font-bold tracking-tight text-base">alola <span class="text-ink-faint">/todos</span></div>
    </div>

    <div class="flex flex-col">
      <div class="px-3 pb-2 text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-ink-faint">Views</div>
      <button class="side-item" :class="{ active: view === 'today' && categoryId === null }" @click="selectView('today')">
        Today <span class="ml-auto text-xs text-ink-faint">{{ counts.today }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'overdue' && categoryId === null }" @click="selectView('overdue')">
        Overdue <span class="ml-auto text-xs" :class="counts.overdue ? 'text-[#c7513a] font-semibold' : 'text-ink-faint'">{{ counts.overdue }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'all' && categoryId === null }" @click="selectView('all')">
        All <span class="ml-auto text-xs text-ink-faint">{{ counts.all }}</span>
      </button>
      <button class="side-item" :class="{ active: view === 'week' && categoryId === null }" @click="selectView('week')">
        This week <span class="ml-auto text-xs text-ink-faint">{{ counts.week }}</span>
      </button>
    </div>

    <div class="flex flex-col">
      <div class="px-3 pb-2 text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-ink-faint">Categories</div>
      <button
        v-for="c in categories"
        :key="c.id"
        class="side-item"
        :class="{ active: categoryId === c.id }"
        @click="selectCategory(c.id)"
      >
        <span class="inline-block w-2 h-2 rounded-full" :style="{ background: c.color }" />
        {{ c.name }}
        <span class="ml-auto text-xs text-ink-faint">{{ counts.byCategory[c.id] ?? 0 }}</span>
      </button>
      <NuxtLink to="/todos/settings/categories" class="side-item text-ink-faint font-normal">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
        New category
      </NuxtLink>
    </div>
  </aside>
</template>

<style scoped>
.side-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.5rem;
  color: theme(colors.ink.muted);
  font-size: 0.88rem;
  font-weight: 500;
  text-align: left;
  width: 100%;
  transition: background-color 0.1s;
}
.side-item:hover { background: rgba(255, 255, 255, 0.025); }
.side-item.active { background: theme(colors.surface.raised); color: theme(colors.ink.DEFAULT); }
</style>
