<script setup lang="ts">
import { ref } from 'vue'
import type { Subtask } from '~/composables/useTasks'
import CheckCircle from '~/components/Todo/CheckCircle.vue'

const props = defineProps<{ subtask: Subtask }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'delete'): void
  (e: 'rename', title: string): void
}>()

const editing = ref(false)
const draft = ref('')

function startEdit() {
  draft.value = props.subtask.title
  editing.value = true
}
function commit() {
  const t = draft.value.trim()
  if (!t) return editing.value = false
  if (t !== props.subtask.title) emit('rename', t)
  editing.value = false
}
</script>

<template>
  <div class="flex items-center gap-2 px-1 py-1.5 border-b border-ink-faint/5 last:border-b-0">
    <CheckCircle :checked="subtask.completed_at !== null" size="sm" @toggle="emit('toggle')" />
    <input
      v-if="editing"
      v-model="draft"
      class="flex-1 bg-transparent text-sm outline-none"
      autofocus
      @blur="commit"
      @keydown.enter.prevent="commit"
      @keydown.esc="editing = false"
    />
    <span
      v-else
      class="flex-1 text-sm cursor-text"
      :class="subtask.completed_at !== null && 'line-through text-ink-faint'"
      @click="startEdit"
    >{{ subtask.title }}</span>
    <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="emit('delete')" aria-label="Delete subtask">
      ×
    </button>
  </div>
</template>
