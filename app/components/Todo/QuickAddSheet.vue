<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCategories } from '~/composables/useCategories'
import { todayAsDueAt, startOfToday, formatDueLabel } from '~/utils/date'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: {
    title: string
    notes?: string
    category_id?: number | null
    priority?: number
    due_at?: number | null
    subtasks?: { title: string; position?: number }[]
  }): void
}>()

const { categories } = useCategories()

const title = ref('')
const notes = ref('')
const categoryId = ref<number | null>(null)
const priority = ref<number>(2)
const dueAt = ref<number | null>(null)
const subtaskDrafts = ref<string[]>([])
const newSubtask = ref('')

function reset() {
  title.value = ''
  notes.value = ''
  categoryId.value = null
  priority.value = 2
  dueAt.value = null
  subtaskDrafts.value = []
  newSubtask.value = ''
}

function pickDateToday() {
  dueAt.value = dueAt.value === todayAsDueAt() ? null : todayAsDueAt()
}
function pickDateTomorrow() {
  const t = startOfToday() + 86400
  dueAt.value = dueAt.value === t ? null : t
}
function cyclePriority() {
  priority.value = priority.value === 3 ? 2 : priority.value === 2 ? 1 : 3
}
function priorityLabel(p: number) { return p === 3 ? 'High' : p === 2 ? 'Medium' : 'Low' }

function addSubtask() {
  const t = newSubtask.value.trim()
  if (!t) return
  subtaskDrafts.value = [...subtaskDrafts.value, t]
  newSubtask.value = ''
}

function removeSubtask(i: number) {
  subtaskDrafts.value = subtaskDrafts.value.filter((_, idx) => idx !== i)
}

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('submit', {
    title: t,
    notes: notes.value.trim() || undefined,
    category_id: categoryId.value,
    priority: priority.value,
    due_at: dueAt.value,
    subtasks: subtaskDrafts.value.map((s, i) => ({ title: s, position: i })),
  })
  reset()
}

const dueLabel = computed(() => formatDueLabel(dueAt.value).label || 'Due')
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/55" @click.self="emit('close')">
      <div class="w-full max-w-xl mx-auto rounded-t-3xl bg-surface-raised p-4 pb-6 shadow-2xl">
        <div class="w-9 h-1 mx-auto mb-3 rounded-full bg-ink-faint" />

        <input
          v-model="title"
          type="text"
          placeholder="New task"
          class="w-full bg-transparent font-display text-lg font-semibold outline-none py-2"
          autofocus
        />
        <textarea
          v-model="notes"
          placeholder="Notes (optional)"
          rows="2"
          class="w-full bg-transparent text-sm text-ink-muted outline-none py-1 resize-none"
        />

        <div class="flex flex-wrap gap-1.5 py-3 border-t border-ink-faint/10">
          <select
            v-model="categoryId"
            class="sheet-chip"
            :class="categoryId !== null && 'sheet-chip-set'"
          >
            <option :value="null">Category</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button type="button" class="sheet-chip" :class="priority !== 2 && 'sheet-chip-set'" @click="cyclePriority">
            {{ priority === 2 ? 'Priority' : priorityLabel(priority) }}
          </button>
          <button type="button" class="sheet-chip" :class="dueAt !== null && 'sheet-chip-set'" @click="pickDateToday">
            {{ dueAt !== null ? dueLabel : 'Today' }}
          </button>
          <button type="button" class="sheet-chip" :class="dueAt === startOfToday() + 86400 && 'sheet-chip-set'" @click="pickDateTomorrow">
            Tomorrow
          </button>
        </div>

        <div class="flex flex-col gap-1 py-1">
          <div v-for="(s, i) in subtaskDrafts" :key="i" class="flex items-center gap-2 text-sm py-1">
            <span class="w-4 h-4 rounded-full border border-ink-faint" />
            <span class="flex-1">{{ s }}</span>
            <button type="button" class="text-xs text-ink-faint hover:text-ink" @click="removeSubtask(i)">remove</button>
          </div>
          <input
            v-model="newSubtask"
            placeholder="Add subtask"
            class="bg-transparent text-sm py-1 outline-none placeholder:text-ink-faint"
            @keydown.enter.prevent="addSubtask"
          />
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-ink-faint/10 mt-2">
          <button type="button" class="text-sm text-ink-muted px-2 py-2" @click="emit('close')">Cancel</button>
          <button type="button" class="bg-accent text-surface px-4 py-2 rounded-lg font-semibold text-sm" @click="submit">
            Add task
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-chip {
  background: theme(colors.surface.subtle);
  border: 1px solid theme(colors.surface.subtle);
  color: theme(colors.ink.muted);
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
}
.sheet-chip-set {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.3);
  color: theme(colors.accent.light);
}
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
