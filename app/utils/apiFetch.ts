// app/utils/apiFetch.ts — wraps $fetch to inject CSRF on mutating requests.
import type { FetchOptions } from 'ofetch'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length))
  }
  return null
}

export async function apiFetch<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const method = (opts.method ?? 'GET').toString().toUpperCase()
  if (MUTATING.has(method)) {
    const token = readCookie('alola_csrf')
    if (token) {
      const headers = new Headers(opts.headers as HeadersInit | undefined)
      headers.set('X-CSRF-Token', token)
      opts.headers = headers
    }
  }
  return await $fetch<T>(url, opts as any)
}
