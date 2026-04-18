// server/middleware/requestContext.ts
// Attaches resolved auth to event.context for all API routes. Handlers that
// need auth call requireAuth() (below); handlers that don't just ignore it.
import { defineEventHandler } from 'h3'
import { resolveAuth, type AuthContext } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}

export default defineEventHandler(async (event) => {
  // Only resolve auth for /api/* — pages don't need it, the client does its own check.
  if (!event.path?.startsWith('/api/')) return
  const ctx = await resolveAuth(event)
  if (ctx) event.context.auth = ctx
})
