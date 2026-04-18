<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{
  (e: 'submit', title: string): void
  (e: 'expand'): void
}>()

const title = ref('')
const input = ref<HTMLInputElement | null>(null)

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('submit', t)
  title.value = ''
}

function focus() {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form class="mx-3 mb-2 flex items-center gap-0 rounded-2xl border border-ink-faint/15 bg-surface-raised px-3" @submit.prevent="submit">
    <svg viewBox="0 0 24 24" class="w-4 h-4 text-ink-muted shrink-0" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
    <input
      ref="input"
      v-model="title"
      type="text"
      placeholder="Add a task…"
      :disabled="disabled"
      class="flex-1 bg-transparent px-2 py-3 text-[0.95rem] outline-none placeholder:text-ink-faint"
      @keydown.meta.enter="submit"
      @keydown.ctrl.enter="submit"
    />
    <button
      type="button"
      :title="'Open full new-task sheet'"
      class="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
      @click="emit('expand')"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16"/></svg>
    </button>
  </form>
</template>
