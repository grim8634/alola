<script setup lang="ts">
import { definePageMeta } from '#imports'
definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Settings' })
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos" class="text-xs uppercase tracking-wider text-ink-muted">← Back to todos</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Settings</h1>
    </header>

    <nav class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
      <NuxtLink to="/todos/settings/categories" class="flex items-center justify-between px-4 py-3 hover:bg-surface-raised">
        <span>Categories</span>
        <span class="text-ink-faint">›</span>
      </NuxtLink>
      <NuxtLink to="/todos/settings/offline" class="flex items-center justify-between px-4 py-3 hover:bg-surface-raised">
        <span>Offline & sync</span>
        <span class="text-ink-faint">›</span>
      </NuxtLink>
    </nav>
  </div>
</template>
