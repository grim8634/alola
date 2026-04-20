<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta } from '#imports'
import { apiFetch } from '~/utils/apiFetch'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'API keys' })

interface Key {
  id: number
  name: string
  key_prefix: string
  created_at: number
  last_used_at: number | null
  revoked_at: number | null
}

const keys = ref<Key[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const newName = ref('')
const creating = ref(false)
const freshPlaintext = ref<string | null>(null)
const freshName = ref<string | null>(null)
const copied = ref(false)

function when(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch<{ keys: Key[] }>('/api/keys')
    keys.value = res.keys
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Failed to load keys'
  } finally {
    loading.value = false
  }
}

async function createKey() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  error.value = null
  try {
    const res = await apiFetch<{ key: Key; plaintext: string }>(
      '/api/keys',
      { method: 'POST', body: { name } },
    )
    keys.value = [res.key, ...keys.value]
    freshPlaintext.value = res.plaintext
    freshName.value = res.key.name
    newName.value = ''
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Failed to create key'
  } finally {
    creating.value = false
  }
}

async function copyFresh() {
  if (!freshPlaintext.value) return
  try {
    await navigator.clipboard.writeText(freshPlaintext.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // fallback: select the input for the user to ⌘-C
  }
}

function dismissFresh() {
  freshPlaintext.value = null
  freshName.value = null
  copied.value = false
}

async function revokeKey(k: Key) {
  if (!confirm(`Revoke "${k.name}"? Any integration using it will stop working immediately.`)) return
  try {
    await apiFetch(`/api/keys/${k.id}`, { method: 'DELETE' })
    keys.value = keys.value.map(x => x.id === k.id ? { ...x, revoked_at: Math.floor(Date.now() / 1000) } : x)
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Revoke failed'
  }
}

const active = computed(() => keys.value.filter(k => k.revoked_at === null))
const revoked = computed(() => keys.value.filter(k => k.revoked_at !== null))

onMounted(refresh)
</script>

<template>
  <div class="space-y-6 py-4 max-w-2xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">API keys</h1>
      <p class="text-sm text-ink-muted mt-1">
        Create bearer tokens for external services to call the todos API on your behalf. API keys can create/read/update tasks, subtasks, and categories — they cannot manage keys themselves or sign you out.
      </p>
    </header>

    <!-- Fresh key display (shown only once, right after creation) -->
    <div v-if="freshPlaintext" class="rounded-xl border border-accent/40 bg-accent/10 p-4 space-y-3">
      <div class="text-sm font-semibold text-ink">Your new key — "{{ freshName }}"</div>
      <div class="text-xs text-ink-muted">
        Copy this now. It won't be shown again. If you lose it, revoke it and create a new one.
      </div>
      <div class="flex items-stretch gap-2">
        <input
          :value="freshPlaintext"
          readonly
          class="flex-1 bg-surface-raised text-xs font-mono px-3 py-2 rounded border border-ink-faint/20 outline-none"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button type="button" class="bg-accent text-surface font-semibold px-3 py-2 rounded text-sm min-w-[72px]" @click="copyFresh">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <button type="button" class="text-xs text-ink-muted underline" @click="dismissFresh">
        I've saved it — hide
      </button>
    </div>

    <!-- New key form -->
    <form class="flex items-center gap-2 rounded-xl border border-ink-faint/15 bg-surface-raised px-3 py-2" @submit.prevent="createKey">
      <input
        v-model="newName"
        placeholder="Name (e.g. AI assistant, e-ink display)"
        class="flex-1 bg-transparent outline-none py-2 text-sm"
        :disabled="creating"
      />
      <button
        type="submit"
        class="bg-accent text-surface px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-60"
        :disabled="creating || !newName.trim()"
      >
        {{ creating ? 'Creating…' : 'New key' }}
      </button>
    </form>

    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

    <!-- Active keys -->
    <section v-if="active.length > 0">
      <h2 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Active</h2>
      <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
        <li v-for="k in active" :key="k.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink">{{ k.name }}</div>
            <div class="text-xs text-ink-muted font-mono mt-0.5">{{ k.key_prefix }}…</div>
            <div class="text-xs text-ink-faint mt-0.5">
              Created {{ when(k.created_at) }} · Last used {{ when(k.last_used_at) }}
            </div>
          </div>
          <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="revokeKey(k)">Revoke</button>
        </li>
      </ul>
    </section>

    <p v-else-if="!loading" class="text-sm text-ink-muted">No active keys. Create one above to get started.</p>

    <!-- Revoked keys (for audit) -->
    <section v-if="revoked.length > 0" class="pt-4 border-t border-ink-faint/10">
      <h2 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Revoked</h2>
      <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden opacity-60">
        <li v-for="k in revoked" :key="k.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink line-through">{{ k.name }}</div>
            <div class="text-xs text-ink-muted font-mono mt-0.5">{{ k.key_prefix }}…</div>
            <div class="text-xs text-ink-faint mt-0.5">
              Revoked {{ when(k.revoked_at) }}
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
