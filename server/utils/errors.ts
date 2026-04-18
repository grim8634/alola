// server/utils/errors.ts
import { createError, type H3Event } from 'h3'

export type ApiErrorCode =
  | 'auth_required'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'client_id_conflict'
  | 'rate_limited'
  | 'internal'

const STATUS: Record<ApiErrorCode, number> = {
  auth_required:       401,
  forbidden:           403,
  not_found:           404,
  validation_failed:   422,
  client_id_conflict:  409,
  rate_limited:        429,
  internal:            500,
}

export function apiError(code: ApiErrorCode, message: string) {
  return createError({
    statusCode: STATUS[code],
    statusMessage: code,
    data: { error: { code, message } },
  })
}

export function throwApiError(code: ApiErrorCode, message: string): never {
  throw apiError(code, message)
}

/** Handy for untrusted input at the top of a handler. */
export function requireField<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || value === '') {
    throwApiError('validation_failed', `${name} is required`)
  }
  return value as T
}
