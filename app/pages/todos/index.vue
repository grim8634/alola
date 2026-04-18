<script setup lang="ts">
import { useSession } from '~/composables/useSession'
import { definePageMeta } from '#imports'

definePageMeta({
  layout: 'app',
  middleware: ['auth'],
})

useHead({ title: 'Todos' })

const { user, logout } = useSession()
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-baseline justify-between">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight">Today</h1>
        <p class="text-sm text-ink-muted">Signed in as {{ user?.email }}</p>
      </div>
      <button
        class="rounded-md border border-ink-faint/20 px-3 py-1.5 text-xs uppercase tracking-wider text-ink-muted hover:text-ink"
        @click="logout"
      >
        Sign out
      </button>
    </header>

    <div class="rounded-xl border border-ink-faint/10 bg-surface-raised/50 px-5 py-8 text-center">
      <p class="font-display text-lg text-ink">Nothing here yet.</p>
      <p class="mt-1 text-sm text-ink-muted">
        Plan 2 fills this view in. You can log in, log out, and hit the auth API.
      </p>
    </div>
  </div>
</template>
