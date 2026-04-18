// server/utils/csrf.ts — double-submit token.
// The token is a 32-byte random value. We put it in a *readable* cookie so the
// client JS can echo it back in an X-CSRF-Token header. A mutating request
// authenticated via cookie must carry both; server compares header === cookie.
import { randomBytes } from 'node:crypto'
import { getCookie, getHeader, type H3Event } from 'h3'
import { CSRF_COOKIE, CSRF_HEADER } from './constants'
import { throwApiError } from './errors'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Throws forbidden if the request lacks a matching CSRF cookie/header pair. */
export function verifyCsrf(event: H3Event) {
  const cookie = getCookie(event, CSRF_COOKIE)
  const header = getHeader(event, CSRF_HEADER)
  if (!cookie || !header || cookie !== header) {
    throwApiError('forbidden', 'CSRF token missing or invalid')
  }
}
