<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Subtask } from '~/composables/useTasks'
import SubtaskRow from '~/components/Todo/SubtaskRow.vue'

const props = defineProps<{ subtasks: Subtask[] }>()
const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'delete', id: number): void
  (e: 'rename', id: number, title: string): void
  (e: 'add', title: string): void
}>()

const draft = ref('')

const progress = computed(() => {
  const total = props.subtasks.length
  if (total === 0) return null
  const done = props.subtasks.filter(s => s.completed_at !== null).length
  return { done, total, pct: Math.round((done / total) * 100) }
})

function addOne() {
  const t = draft.value.trim()
  if (!t) return
  emit('add', t)
  draft.value = ''
}
</script>

<template>
  <div>
    <div v-if="progress" class="h-[3px] bg-surface-subtle rounded overflow-hidden mb-2">
      <div class="h-full bg-accent transition-[width] duration-200" :style="{ width: `${progress.pct}%` }" />
    </div>

    <SubtaskRow
      v-for="s in subtasks"
      :key="s.id"
      :subtask="s"
      @toggle="emit('toggle', s.id)"
      @delete="emit('delete', s.id)"
      @rename="(t) => emit('rename', s.id, t)"
    />

    <div class="flex items-center gap-2 mt-2 py-1">
      <span class="w-[18px] h-[18px] rounded-full border border-dashed border-ink-faint inline-flex items-center justify-center text-ink-faint text-xs">+</span>
      <input
        v-model="draft"
        class="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        placeholder="Add subtask"
        @keydown.enter.prevent="addOne"
      />
    </div>
  </div>
</template>
