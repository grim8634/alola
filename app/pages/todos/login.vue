<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, navigateTo, definePageMeta } from '#imports'
import { useSession } from '~/composables/useSession'

definePageMeta({
  layout: 'app',
  skipAuth: true,
})

useHead({ title: 'Sign in' })

const { login, refresh, isAuthenticated } = useSession()
const route = useRoute()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  // If we arrived here with an already-valid session, bounce forward.
  await refresh()
  if (isAuthenticated.value) await goNext()
})

async function goNext() {
  const next = typeof route.query.next === 'string' ? route.query.next : '/todos'
  // Only allow same-origin paths.
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/todos'
  await navigateTo(safe)
}

async function onSubmit() {
  errorMsg.value = null
  submitting.value = true
  try {
    await login(email.value.trim(), password.value)
    await goNext()
  } catch (e: any) {
    errorMsg.value = e?.data?.error?.message ?? 'Sign in failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <form class="w-full max-w-sm space-y-5" @submit.prevent="onSubmit">
      <div class="space-y-1">
        <div class="font-display text-2xl font-bold tracking-tight">alola <span class="text-ink-faint">/todos</span></div>
        <div class="text-sm text-ink-muted">Sign in to continue</div>
      </div>

      <label class="block space-y-1.5">
        <span class="text-xs uppercase tracking-wider text-ink-muted">Email</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="w-full rounded-lg border border-ink-faint/20 bg-surface-raised px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>

      <label class="block space-y-1.5">
        <span class="text-xs uppercase tracking-wider text-ink-muted">Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-lg border border-ink-faint/20 bg-surface-raised px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>

      <p v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface transition-opacity disabled:opacity-60"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
