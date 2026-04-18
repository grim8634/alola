<script setup lang="ts">
import { ref } from 'vue'
import { definePageMeta } from '#imports'
import { useCategories, type Category } from '~/composables/useCategories'
import { onMounted } from 'vue'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'Categories' })

const { categories, refresh, create, update, remove, loaded } = useCategories()

const newName = ref('')
const newColor = ref('#4a7c59')
const error = ref<string | null>(null)

const SUGGESTED_COLORS = ['#4a7c59', '#3b82f6', '#8b5cf6', '#e879c8', '#d97706', '#14b8a6', '#ef4444', '#a855f7']

onMounted(async () => { if (!loaded.value) await refresh() })

async function addCategory() {
  error.value = null
  try {
    await create({ name: newName.value.trim(), color: newColor.value, position: categories.value.length })
    newName.value = ''
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Could not create category'
  }
}

async function renameCategory(c: Category, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed === c.name) return
  try { await update(c.id, { name: trimmed }) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Rename failed' }
}

async function recolor(c: Category, color: string) {
  if (color === c.color) return
  try { await update(c.id, { color }) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Recolour failed' }
}

async function removeCategory(c: Category) {
  if (!confirm(`Delete category "${c.name}"? Tasks in it become uncategorised.`)) return
  try { await remove(c.id) }
  catch (e: any) { error.value = e?.data?.error?.message ?? 'Delete failed' }
}
</script>

<template>
  <div class="space-y-6 py-4 max-w-xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">Categories</h1>
    </header>

    <form class="flex items-center gap-2 rounded-xl border border-ink-faint/15 bg-surface-raised px-3 py-2" @submit.prevent="addCategory">
      <select v-model="newColor" class="bg-transparent outline-none text-sm">
        <option v-for="c in SUGGESTED_COLORS" :key="c" :value="c" :style="{ color: c }">{{ c }}</option>
      </select>
      <input v-model="newName" placeholder="New category name" class="flex-1 bg-transparent outline-none py-2" />
      <button type="submit" class="bg-accent text-surface px-3 py-1.5 rounded text-sm font-semibold">Add</button>
    </form>
    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

    <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
      <li v-for="c in categories" :key="c.id" class="flex items-center gap-3 px-4 py-3">
        <input
          type="color"
          :value="c.color"
          class="w-5 h-5 rounded-full border-none bg-transparent cursor-pointer p-0"
          @change="(e: any) => recolor(c, e.target.value)"
        />
        <input
          :value="c.name"
          class="flex-1 bg-transparent outline-none text-sm"
          @blur="(e: any) => renameCategory(c, e.target.value)"
          @keydown.enter.prevent="(e: any) => renameCategory(c, e.target.value)"
        />
        <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="removeCategory(c)">Delete</button>
      </li>
    </ul>
  </div>
</template>
