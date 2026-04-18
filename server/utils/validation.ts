// server/utils/validation.ts — small helpers for parsing untrusted bodies.
import { throwApiError } from './errors'

export function requireString(v: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
  if (typeof v !== 'string') throwApiError('validation_failed', `${field} must be a string`)
  const s = (v as string).trim()
  if (opts.min !== undefined && s.length < opts.min) throwApiError('validation_failed', `${field} is too short`)
  if (opts.max !== undefined && s.length > opts.max) throwApiError('validation_failed', `${field} is too long`)
  return s
}

export function optionalString(v: unknown, field: string, opts: { max?: number } = {}): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return requireString(v, field, opts)
}

export function optionalInt(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throwApiError('validation_failed', `${field} must be an integer`)
  if (opts.min !== undefined && n < opts.min) throwApiError('validation_failed', `${field} is too small`)
  if (opts.max !== undefined && n > opts.max) throwApiError('validation_failed', `${field} is too large`)
  return n
}

export function requireInt(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = optionalInt(v, field, opts)
  if (n === undefined) throwApiError('validation_failed', `${field} is required`)
  return n!
}

export function requireEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throwApiError('validation_failed', `${field} must be one of ${allowed.join(', ')}`)
  }
  return v as T
}

export function optionalEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return requireEnum(v, field, allowed)
}

export function requireHexColor(v: unknown, field: string): string {
  const s = requireString(v, field)
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throwApiError('validation_failed', `${field} must be a hex colour like #4a7c59`)
  return s.toLowerCase()
}
