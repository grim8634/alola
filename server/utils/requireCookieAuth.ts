// server/utils/requireCookieAuth.ts — rejects bearer tokens on endpoints that
// should only be reachable from the authenticated web UI (key management, auth).
import type { H3Event } from 'h3'
import { requireAuth, type AuthContext } from './auth'
import { throwApiError } from './errors'

export function requireCookieAuth(event: H3Event): AuthContext {
  const ctx = requireAuth(event)
  if (ctx.authMethod !== 'cookie') {
    throwApiError('forbidden', 'This endpoint requires cookie authentication')
  }
  return ctx
}
