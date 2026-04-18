<script setup lang="ts">
import { definePageMeta } from '#imports'
import { useSyncQueue } from '~/composables/useSyncQueue'
import { useOnline } from '~/composables/useOnline'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Offline & sync' })

const { pending, lastSyncAt, manualFlush, status, deadCount } = useSyncQueue()
const { online } = useOnline()

function when(ts: number | null | undefined) {
  if (!ts) return 'never'
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Offline & sync</h1>
    </header>

    <section class="space-y-3">
      <p class="text-sm text-ink-muted leading-relaxed">
        Todos works offline. Your device keeps a copy of the last-seen list, and any changes you make while
        disconnected queue up here and send when you're back online. Mutations sync on reconnect and when the
        tab becomes active.
      </p>

      <div class="rounded-xl border border-ink-faint/10 divide-y divide-ink-faint/10">
        <div class="flex justify-between px-4 py-3 text-sm"><span>Network</span><span :class="online ? 'text-emerald-400' : 'text-ink-faint'">{{ online ? 'Online' : 'Offline' }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Sync status</span><span>{{ status }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Pending changes</span><span>{{ pending.length }}</span></div>
        <div class="flex justify-between px-4 py-3 text-sm"><span>Last sync</span><span>{{ when(lastSyncAt) }}</span></div>
        <div v-if="deadCount" class="flex justify-between px-4 py-3 text-sm text-red-400"><span>Failed mutations</span><span>{{ deadCount }}</span></div>
      </div>

      <button type="button" class="bg-accent text-surface px-3 py-2 rounded text-sm font-semibold" @click="manualFlush">
        Sync now
      </button>
    </section>
  </div>
</template>
