<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, definePageMeta } from '#imports'
import { useSession } from '~/composables/useSession'
import { useCategories } from '~/composables/useCategories'
import { useTasks } from '~/composables/useTasks'
import { useCurrentView } from '~/composables/useCurrentView'
import { useUndoSnackbar } from '~/composables/useUndoSnackbar'
import { startOfToday, startOfTomorrow, startOfNextWeek } from '~/utils/date'

import Sidebar from '~/components/Todo/Sidebar.vue'
import QuickAdd from '~/components/Todo/QuickAdd.vue'
import QuickAddSheet from '~/components/Todo/QuickAddSheet.vue'
import FilterChips from '~/components/Todo/FilterChips.vue'
import TaskList from '~/components/Todo/TaskList.vue'
import TaskDetail from '~/components/Todo/TaskDetail.vue'
import Snackbar from '~/components/Todo/Snackbar.vue'
import OfflineBanner from '~/components/Todo/OfflineBanner.vue'
import InstallHint from '~/components/Todo/InstallHint.vue'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Todos' })

const route = useRoute()
const router = useRouter()

const { user, logout } = useSession()
const categoriesStore = useCategories()
const tasksStore = useTasks()
const { view, categoryId, selectedTaskId, setFilter } = useCurrentView()
const snack = useUndoSnackbar()

const sheetOpen = ref(false)
const sheetInitialTitle = ref('')
const quickAdd = ref<InstanceType<typeof QuickAdd> | null>(null)

function openSheet(draft = '') {
  sheetInitialTitle.value = draft
  sheetOpen.value = true
}

// Initial load.
onMounted(async () => {
  // IDB hydrate already happened in app/plugins/pwa.client.ts. Refresh in background
  // without blocking first paint; if offline, these reject silently and we keep
  // showing cached data.
  void categoriesStore.refresh()
  void tasksStore.refresh('all')
  // PWA manifest shortcut: ?new=1 opens the expanded sheet.
  if (route.query.new === '1') {
    sheetOpen.value = true
    // Strip the param from URL so reload doesn't re-trigger.
    const q = { ...route.query }
    delete q.new
    router.replace({ query: q })
  }
})

// Keyboard: 'n' focuses quick-add. 'x' completes selected task.
function onKey(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
  if (e.key === 'n') { e.preventDefault(); quickAdd.value?.focus() }
  if (e.key === 'x' && selectedTaskId.value !== null) onToggle(selectedTaskId.value)
}
onMounted(() => window.addEventListener('keydown', onKey))
// watch cleanup — we'd use onUnmounted, but page unmounts reliably via Nuxt
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKey))

// --- Projection ---
const visibleTasks = computed(() => {
  const p = tasksStore.projection(view.value, categoryId.value)
  return p.value
})

// --- Counts for sidebar ---
const counts = computed(() => {
  const today = startOfToday()
  const tomorrow = startOfTomorrow()
  const nextWeek = startOfNextWeek()
  const all = tasksStore.tasks.value
  const byCategory: Record<number, number> = {}
  let todayCount = 0, overdueCount = 0, allCount = 0, weekCount = 0
  for (const t of all) {
    if (t.completed_at !== null && t.completed_at < today) continue
    if (t.completed_at !== null) continue  // completed today doesn't contribute to active counts
    allCount++
    if (t.due_at === null || t.due_at < tomorrow) todayCount++
    if (t.due_at !== null && t.due_at < today) overdueCount++
    if (t.due_at === null || t.due_at < nextWeek) weekCount++
    if (t.category_id !== null) byCategory[t.category_id] = (byCategory[t.category_id] ?? 0) + 1
  }
  return { today: todayCount, overdue: overdueCount, all: allCount, week: weekCount, byCategory }
})

// --- Handlers ---
async function onQuickSubmit(title: string) {
  try {
    await tasksStore.create({ title, category_id: categoryId.value })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to add task')
  }
}

async function onSheetSubmit(payload: any) {
  sheetOpen.value = false
  try {
    await tasksStore.create(payload)
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to add task')
  }
}

async function onToggle(id: number) {
  const t = tasksStore.tasks.value.find(x => x.id === id)
  if (!t) return
  try {
    if (t.completed_at === null) await tasksStore.complete(id)
    else await tasksStore.uncomplete(id)
  } catch (e: any) {
    console.error('[todos] toggle failed', e)
    snack.show(e?.data?.error?.message ?? e?.message ?? 'Failed to update task')
  }
}

async function onSwipeComplete(id: number) {
  try {
    await tasksStore.complete(id)
    snack.show('Completed', async () => { await tasksStore.uncomplete(id) })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to complete')
  }
}

async function onSwipeDelete(id: number) {
  const t = tasksStore.tasks.value.find(x => x.id === id)
  if (!t) return
  const snapshot = JSON.parse(JSON.stringify(t))
  try {
    await tasksStore.destroy(id)
    snack.show('Deleted', async () => {
      // Best-effort undo: recreate with the same fields. New id. Good enough for v1.
      await tasksStore.create({
        title: snapshot.title,
        notes: snapshot.notes ?? undefined,
        category_id: snapshot.category_id ?? undefined,
        priority: snapshot.priority,
        due_at: snapshot.due_at ?? undefined,
      })
    })
  } catch (e: any) {
    snack.show(e?.data?.error?.message ?? 'Failed to delete')
  }
}

function onOpen(id: number) {
  selectedTaskId.value = id
}
function closeDetail() {
  selectedTaskId.value = null
}

async function onDetailPatch(patch: any) {
  if (selectedTaskId.value === null) return
  try { await tasksStore.update(selectedTaskId.value, patch) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to update') }
}
async function onDetailDelete() {
  if (selectedTaskId.value === null) return
  const id = selectedTaskId.value
  selectedTaskId.value = null
  await onSwipeDelete(id)
}
async function onDetailAddSubtask(title: string) {
  if (selectedTaskId.value === null) return
  try { await tasksStore.addSubtask(selectedTaskId.value, title) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to add subtask') }
}
async function onDetailToggleSubtask(id: number) {
  try { await tasksStore.toggleSubtask(id) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to toggle subtask') }
}
async function onDetailDeleteSubtask(id: number) {
  try { await tasksStore.deleteSubtask(id) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to delete subtask') }
}
async function onDetailRenameSubtask(id: number, title: string) {
  try { await tasksStore.updateSubtask(id, { title }) }
  catch (e: any) { snack.show(e?.data?.error?.message ?? 'Failed to rename subtask') }
}

const selectedTask = computed(() => selectedTaskId.value === null ? null : tasksStore.tasks.value.find(t => t.id === selectedTaskId.value) ?? null)

const completedCount = computed(() => tasksStore.tasks.value.filter(t => t.completed_at !== null).length)

const viewTitle = computed(() => {
  if (categoryId.value !== null) {
    return categoriesStore.byId.value.get(categoryId.value)?.name ?? 'Category'
  }
  return { today: 'Today', overdue: 'Overdue', week: 'This week', all: 'All tasks' }[view.value]
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-0px)] lg:min-h-screen lg:max-h-screen lg:overflow-hidden -mx-4 -mt-4 lg:-mx-6 lg:-mt-6">
    <Sidebar
      :view="view"
      :category-id="categoryId"
      :counts="counts"
      @select="setFilter"
    />

    <!-- Main column: list + optional desktop detail -->
    <div class="flex-1 min-w-0 flex">
      <!-- List pane -->
      <section class="flex-1 min-w-0 flex flex-col" :class="selectedTaskId !== null && 'hidden md:flex'">
        <header class="flex items-baseline justify-between px-4 pt-4 lg:pt-6 pb-2">
          <div>
            <h1 class="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <span>{{ viewTitle }}</span>
              <button
                v-if="categoryId !== null"
                type="button"
                class="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-ink hover:bg-surface-raised text-lg leading-none"
                aria-label="Clear category filter"
                title="Clear category filter"
                @click="categoryId = null"
              >×</button>
            </h1>
            <p class="text-xs text-ink-muted">Signed in as {{ user?.email }}</p>
          </div>
          <button class="text-xs uppercase tracking-wider text-ink-muted border border-ink-faint/20 rounded-md px-2 py-1 hover:text-ink" @click="logout">
            Sign out
          </button>
        </header>

        <OfflineBanner />
        <QuickAdd ref="quickAdd" @submit="onQuickSubmit" @expand="openSheet" />
        <FilterChips :view="view" :category-id="categoryId" @select="setFilter" />

        <div class="flex-1 overflow-y-auto px-1 pb-20">
          <TaskList
            :tasks="visibleTasks"
            :view="view"
            :selected-task-id="selectedTaskId"
            @toggle="onToggle"
            @open="onOpen"
            @swipe-complete="onSwipeComplete"
            @swipe-delete="onSwipeDelete"
          />
        </div>
      </section>

      <!-- Detail pane -->
      <section
        v-if="selectedTask"
        class="flex-1 min-w-0 md:flex-[0_0_400px] border-l border-ink-faint/10 bg-surface"
        :class="selectedTaskId === null && 'hidden'"
      >
        <TaskDetail
          :task="selectedTask"
          @close="closeDetail"
          @patch="onDetailPatch"
          @delete="onDetailDelete"
          @toggle="onToggle(selectedTask!.id)"
          @add-subtask="onDetailAddSubtask"
          @toggle-subtask="onDetailToggleSubtask"
          @delete-subtask="onDetailDeleteSubtask"
          @rename-subtask="onDetailRenameSubtask"
        />
      </section>
    </div>

    <QuickAddSheet :open="sheetOpen" :initial-title="sheetInitialTitle" @close="sheetOpen = false" @submit="onSheetSubmit" />
    <Snackbar />
    <InstallHint :engagement-hit="completedCount >= 3" />
  </div>
</template>
