<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '~/composables/useTasks'
import { useCategories } from '~/composables/useCategories'
import { formatDueLabel } from '~/utils/date'
import CheckCircle from '~/components/Todo/CheckCircle.vue'
import PriorityPill from '~/components/Todo/PriorityPill.vue'
import CategoryChip from '~/components/Todo/CategoryChip.vue'

const props = defineProps<{
  task: Task
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'open'): void
  (e: 'swipe-complete'): void
  (e: 'swipe-delete'): void
}>()

const { byId } = useCategories()
const category = computed(() => props.task.category_id ? byId.value.get(props.task.category_id) : null)
const due = computed(() => formatDueLabel(props.task.due_at))
const subtaskProgress = computed(() => {
  const total = props.task.subtasks.length
  if (total === 0) return null
  const done = props.task.subtasks.filter(s => s.completed_at !== null).length
  return `${done} of ${total}`
})
const isHigh = computed(() => props.task.priority === 3)
const done = computed(() => props.task.completed_at !== null)

// --- Swipe handling (touch only; desktop uses click) ---
const dx = ref(0)
const swiping = ref(false)
const SWIPE_THRESHOLD = 80
let startX = 0
let startY = 0

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  startX = t.clientX
  startY = t.clientY
  swiping.value = true
}
function onTouchMove(e: TouchEvent) {
  if (!swiping.value) return
  const t = e.touches[0]
  const dxNow = t.clientX - startX
  const dyNow = t.clientY - startY
  // Ignore mostly-vertical drags (scroll intent).
  if (Math.abs(dyNow) > Math.abs(dxNow)) { swiping.value = false; dx.value = 0; return }
  dx.value = dxNow
}
function onTouchEnd() {
  if (!swiping.value) return
  swiping.value = false
  if (dx.value >= SWIPE_THRESHOLD) emit('swipe-complete')
  else if (dx.value <= -SWIPE_THRESHOLD) emit('swipe-delete')
  dx.value = 0
}
</script>

<template>
  <div class="relative overflow-hidden rounded-xl" :class="{ 'bg-accent/8': selected }">
    <!-- Swipe reveal backgrounds -->
    <div
      class="absolute inset-y-0 left-0 w-20 flex items-center justify-center text-white bg-emerald-700/90"
      :style="{ opacity: dx > 8 ? 1 : 0 }"
    >
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div
      class="absolute inset-y-0 right-0 w-20 flex items-center justify-center text-white bg-red-800/90"
      :style="{ opacity: dx < -8 ? 1 : 0 }"
    >
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
    </div>

    <!-- Foreground row -->
    <div
      class="relative bg-surface flex items-start gap-3 px-3 py-2.5 cursor-pointer"
      :class="[done && 'opacity-60']"
      :style="{ transform: `translateX(${dx}px)`, transition: swiping ? 'none' : 'transform 0.2s ease-out' }"
      @click="emit('open')"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <CheckCircle :checked="done" :high-priority="isHigh" @toggle="emit('toggle')" class="mt-[2px]" />
      <div class="flex-1 min-w-0">
        <div class="text-[0.95rem] leading-snug" :class="[done && 'line-through text-ink-faint', isHigh && !done && 'font-semibold', !done && !isHigh && 'font-medium']">
          {{ task.title }}
        </div>
        <div class="flex items-center gap-1.5 mt-1 text-[0.73rem] text-ink-muted flex-wrap">
          <CategoryChip v-if="category" :color="category.color" :name="category.name" dense />
          <template v-if="category && (due.label || subtaskProgress)"><span class="text-ink-faint">·</span></template>
          <span
            v-if="due.label"
            :class="{
              'text-[#c7513a] font-semibold': due.tone === 'overdue',
              'text-accent-light font-semibold': due.tone === 'today',
            }"
          >{{ due.label }}</span>
          <template v-if="due.label && subtaskProgress"><span class="text-ink-faint">·</span></template>
          <span v-if="subtaskProgress">{{ subtaskProgress }}</span>
        </div>
      </div>
      <PriorityPill :priority="task.priority" class="mt-[3px]" />
    </div>
  </div>
</template>
