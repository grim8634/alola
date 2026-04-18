<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Task } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'
import { formatDueLabel, startOfToday } from '~/utils/date'
import SubtaskList from '~/components/Todo/SubtaskList.vue'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'patch', patch: Partial<Pick<Task, 'title' | 'notes' | 'category_id' | 'priority' | 'due_at'>>): void
  (e: 'delete'): void
  (e: 'toggle'): void
  (e: 'add-subtask', title: string): void
  (e: 'toggle-subtask', id: number): void
  (e: 'delete-subtask', id: number): void
  (e: 'rename-subtask', id: number, title: string): void
}>()

const { categories } = useCategories()

const title = ref(props.task.title)
const notes = ref(props.task.notes ?? '')
const categoryId = ref<number | null>(props.task.category_id)
const priority = ref<number>(props.task.priority)
const dueAt = ref<number | null>(props.task.due_at)

watch(() => props.task, (t) => {
  title.value = t.title
  notes.value = t.notes ?? ''
  categoryId.value = t.category_id
  priority.value = t.priority
  dueAt.value = t.due_at
})

function commitTitle() {
  const t = title.value.trim()
  if (!t || t === props.task.title) { title.value = props.task.title; return }
  emit('patch', { title: t })
}
function commitNotes() {
  const n = notes.value.trim() || null
  if (n === (props.task.notes ?? null)) return
  emit('patch', { notes: n })
}
function setCategory(id: number | null) {
  if (id === props.task.category_id) return
  emit('patch', { category_id: id })
}
function setPriority(p: number) {
  if (p === props.task.priority) return
  emit('patch', { priority: p })
}
function setDueOffset(daysFromToday: number | null) {
  const due = daysFromToday === null ? null : startOfToday() + daysFromToday * 86400
  if (due === props.task.due_at) return
  emit('patch', { due_at: due })
}

const dueLabel = computed(() => formatDueLabel(dueAt.value).label || '—')
const category = computed(() => categoryId.value === null ? null : categories.value.find(c => c.id === categoryId.value) ?? null)
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-surface">
    <header class="flex items-center justify-between px-4 py-3 border-b border-ink-faint/10">
      <button type="button" class="text-sm text-ink-muted flex items-center gap-1" @click="emit('close')" aria-label="Close">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </button>
      <button type="button" class="text-[#c7513a] hover:opacity-80" @click="emit('delete')" aria-label="Delete task">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
      <input
        v-model="title"
        class="font-display text-[1.3rem] font-semibold bg-transparent outline-none leading-tight"
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
      />

      <div class="grid grid-cols-2 gap-2">
        <label class="meta-tile">
          <span class="k">Category</span>
          <select class="v bg-transparent outline-none" :value="categoryId ?? ''" @change="(e: any) => setCategory(e.target.value === '' ? null : Number(e.target.value))">
            <option value="">None</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="meta-tile">
          <span class="k">Priority</span>
          <select class="v bg-transparent outline-none" :value="priority" @change="(e: any) => setPriority(Number(e.target.value))">
            <option :value="3">High</option>
            <option :value="2">Medium</option>
            <option :value="1">Low</option>
          </select>
        </label>
        <label class="meta-tile col-span-2">
          <span class="k">Due</span>
          <div class="flex gap-2 items-center">
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(0)">Today</button>
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(1)">Tomorrow</button>
            <button type="button" class="text-xs underline text-ink-muted" @click="setDueOffset(7)">Next week</button>
            <button type="button" class="text-xs underline text-ink-faint" @click="setDueOffset(null)">Clear</button>
            <span class="ml-auto text-sm">{{ dueLabel }}</span>
          </div>
        </label>
      </div>

      <section>
        <h3 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Notes</h3>
        <textarea
          v-model="notes"
          class="w-full bg-surface-raised/60 text-sm p-3 rounded-lg outline-none resize-y min-h-[70px]"
          placeholder="Add notes…"
          @blur="commitNotes"
        />
      </section>

      <section>
        <h3 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2 flex justify-between">
          <span>Subtasks</span>
          <span class="lowercase tracking-normal text-ink-muted text-xs">{{ task.subtasks.filter(s => s.completed_at !== null).length }} of {{ task.subtasks.length }}</span>
        </h3>
        <SubtaskList
          :subtasks="task.subtasks"
          @toggle="(id) => emit('toggle-subtask', id)"
          @delete="(id) => emit('delete-subtask', id)"
          @rename="(id, t) => emit('rename-subtask', id, t)"
          @add="(t) => emit('add-subtask', t)"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.meta-tile {
  background: theme(colors.surface.raised);
  border: 1px solid theme(colors.surface.subtle);
  border-radius: 0.6rem;
  padding: 0.5rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.k { font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: theme(colors.ink.faint); font-weight: 600; }
.v { font-size: 0.85rem; color: theme(colors.ink.DEFAULT); font-weight: 500; }
</style>
