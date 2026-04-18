// server/utils/constants.ts
export const SESSION_COOKIE = 'alola_session'
export const CSRF_COOKIE = 'alola_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  // 30 days
export const SESSION_SLIDE_THRESHOLD_SECONDS = 7 * 24 * 60 * 60  // slide forward when < 7d remain

export const RATE_LIMITS = {
  login:   { windowMs: 60_000, max: 5   },  // per IP
  writes:  { windowMs: 60_000, max: 60  },  // per user
} as const

export const BEARER_PREFIX = 'alola_tk_'
