<script setup lang="ts">
import { computed } from 'vue'
import type { Task, View } from '~/composables/useTasks'
import { startOfToday, startOfTomorrow } from '~/utils/date'
import TaskRow from '~/components/Todo/TaskRow.vue'

const props = defineProps<{
  tasks: Task[]
  view: View
  selectedTaskId: number | null
}>()

const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'open', id: number): void
  (e: 'swipe-complete', id: number): void
  (e: 'swipe-delete', id: number): void
}>()

interface Section { label: string; tone?: 'overdue' | 'default'; tasks: Task[] }

const sections = computed<Section[]>(() => {
  const today = startOfToday()
  const tomorrow = startOfTomorrow()
  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const upcoming: Task[] = []
  const completedToday: Task[] = []

  for (const t of props.tasks) {
    if (t.completed_at !== null && t.completed_at >= today) { completedToday.push(t); continue }
    if (t.completed_at !== null) continue  // should already be filtered out; belt & braces
    if (t.due_at !== null && t.due_at < today) { overdue.push(t); continue }
    if (t.due_at !== null && t.due_at < tomorrow) { todayTasks.push(t); continue }
    upcoming.push(t)
  }

  const out: Section[] = []
  if (overdue.length)        out.push({ label: `Overdue · ${overdue.length}`, tone: 'overdue', tasks: overdue })
  if (todayTasks.length)     out.push({ label: `Today · ${todayTasks.length}`, tasks: todayTasks })
  if (upcoming.length && props.view !== 'today' && props.view !== 'overdue') {
    out.push({ label: `Upcoming · ${upcoming.length}`, tasks: upcoming })
  }
  if (upcoming.length && props.view === 'today') {
    // If the user only asks for today but we also have undated, show them under a catch-all.
    out.push({ label: `Later · ${upcoming.length}`, tasks: upcoming })
  }
  if (completedToday.length) out.push({ label: `Completed today · ${completedToday.length}`, tasks: completedToday })
  return out
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <template v-for="s in sections" :key="s.label">
      <div
        class="px-2 pt-3 pb-1 text-[0.68rem] uppercase tracking-[0.1em] font-semibold"
        :class="s.tone === 'overdue' ? 'text-[#c7513a]' : 'text-ink-faint'"
      >{{ s.label }}</div>
      <TaskRow
        v-for="task in s.tasks"
        :key="task.id"
        :task="task"
        :selected="task.id === selectedTaskId"
        @toggle="emit('toggle', task.id)"
        @open="emit('open', task.id)"
        @swipe-complete="emit('swipe-complete', task.id)"
        @swipe-delete="emit('swipe-delete', task.id)"
      />
    </template>

    <div v-if="sections.length === 0" class="py-14 text-center text-ink-muted">
      <p class="font-display text-lg text-ink">Nothing here.</p>
      <p class="mt-1 text-sm">Add a task above to get started.</p>
    </div>
  </div>
</template>
