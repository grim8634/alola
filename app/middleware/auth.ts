// app/middleware/auth.ts — redirects unauthenticated users to the login page.
// Applied on /todos/* pages except /todos/login (which sets skipAuth in meta).
import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useSession } from '~/composables/useSession'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.skipAuth) return
  const { loaded, isAuthenticated, refresh } = useSession()
  if (!loaded.value) await refresh()
  if (!isAuthenticated.value) {
    return navigateTo({
      path: '/todos/login',
      query: { next: to.fullPath },
    })
  }
})
