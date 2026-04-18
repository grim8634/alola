// app/composables/useSession.ts
import { ref, computed } from 'vue'
import { navigateTo } from '#app'
import { apiFetch } from '~/utils/apiFetch'

export interface SessionUser {
  id: number
  email: string
  tz: string
}

const user = ref<SessionUser | null>(null)
const loaded = ref(false)

export function useSession() {
  const isAuthenticated = computed(() => user.value !== null)

  async function refresh() {
    try {
      user.value = await apiFetch<SessionUser>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(email: string, password: string) {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    await refresh()
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* best-effort */
    }
    user.value = null
    await navigateTo('/todos/login')
  }

  return { user, loaded, isAuthenticated, refresh, login, logout }
}
