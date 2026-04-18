// server/utils/rateLimit.ts — in-memory token bucket. Best-effort on serverless
// (each function instance has its own bucket). Fine for a single-user app.
import { throwApiError } from './errors'

interface Bucket {
  tokens: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Call at the top of a handler; throws rate_limited if exceeded. */
export function rateLimit(key: string, opts: { windowMs: number; max: number }) {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { tokens: opts.max, resetAt: now + opts.windowMs }
    buckets.set(key, bucket)
  }
  if (bucket.tokens <= 0) {
    throwApiError('rate_limited', 'Too many requests — slow down.')
  }
  bucket.tokens -= 1
}

/** Periodically prune old buckets so the map doesn't grow unbounded. */
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
}, 5 * 60_000).unref?.()
