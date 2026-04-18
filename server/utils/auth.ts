// server/utils/auth.ts — resolves user_id from session cookie OR bearer API key.
// Bearer path is STUBBED in Plan 1 (returns null); Plan 4 finishes it.
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3'
import { db } from './db'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  SESSION_TTL_SECONDS,
  SESSION_SLIDE_THRESHOLD_SECONDS,
  BEARER_PREFIX,
} from './constants'
import { generateCsrfToken } from './csrf'
import { throwApiError } from './errors'

export interface AuthContext {
  userId: number
  sessionId?: string  // set when auth came from a cookie, not a bearer
  authMethod: 'cookie' | 'bearer'
}

/** Generate a new session id. */
export function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

/** Create a session row and set both cookies on the response. */
export async function startSession(event: H3Event, userId: number): Promise<string> {
  const id = newSessionId()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + SESSION_TTL_SECONDS
  const ua = getHeader(event, 'user-agent') ?? null
  const ip =
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getHeader(event, 'x-real-ip') ??
    null

  await db().execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)',
    args: [id, userId, expiresAt, ua, ip],
  })

  setCookie(event, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  setCookie(event, CSRF_COOKIE, generateCsrfToken(), {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  return id
}

/** Delete the session row and clear both cookies. No-op if not logged in. */
export async function endSession(event: H3Event) {
  const id = getCookie(event, SESSION_COOKIE)
  if (id) {
    await db().execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [id] })
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, CSRF_COOKIE, { path: '/' })
}

/** Purge expired sessions. Called opportunistically on login. */
export async function purgeExpiredSessions() {
  const now = Math.floor(Date.now() / 1000)
  await db().execute({ sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [now] })
}

/**
 * Resolve the authenticated user for this event.
 * Returns null if unauthenticated.
 * Slides session expiry forward when within the slide threshold.
 */
export async function resolveAuth(event: H3Event): Promise<AuthContext | null> {
  // 1. Cookie session
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) {
    const now = Math.floor(Date.now() / 1000)
    const { rows } = await db().execute({
      sql: 'SELECT user_id, expires_at FROM sessions WHERE id = ?',
      args: [sessionId],
    })
    if (rows.length > 0) {
      const row = rows[0]
      const expiresAt = Number(row.expires_at)
      if (expiresAt > now) {
        // Touch last_used_at
        await db().execute({
          sql: 'UPDATE sessions SET last_used_at = ? WHERE id = ?',
          args: [now, sessionId],
        })
        // Slide expiry if close to the edge
        if (expiresAt - now < SESSION_SLIDE_THRESHOLD_SECONDS) {
          const newExpires = now + SESSION_TTL_SECONDS
          await db().execute({
            sql: 'UPDATE sessions SET expires_at = ? WHERE id = ?',
            args: [newExpires, sessionId],
          })
          // Re-set both cookies so the browser picks up the new max-age.
          // Re-use the existing CSRF token so in-flight requests aren't broken.
          setCookie(event, SESSION_COOKIE, sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL_SECONDS,
          })
          const currentCsrf = getCookie(event, CSRF_COOKIE) ?? generateCsrfToken()
          setCookie(event, CSRF_COOKIE, currentCsrf, {
            httpOnly: false,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL_SECONDS,
          })
        }
        return {
          userId: Number(row.user_id),
          sessionId,
          authMethod: 'cookie',
        }
      }
    }
  }

  // 2. Bearer API key — STUB. Plan 4 implements the full path.
  const authz = getHeader(event, 'authorization')
  if (authz && authz.startsWith('Bearer ')) {
    const token = authz.slice(7)
    if (token.startsWith(BEARER_PREFIX)) {
      // Placeholder: real implementation in Plan 4.
      return null
    }
  }

  return null
}

/** Throws auth_required if the event has no resolved auth context. */
export function requireAuth(event: H3Event): AuthContext {
  const ctx = event.context.auth
  if (!ctx) throwApiError('auth_required', 'Authentication required')
  return ctx
}
