// server/utils/apiKeys.ts — generate, hash, compare, extract-prefix helpers for API keys.
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { BEARER_PREFIX } from './constants'

/**
 * Key layout:
 *   alola_tk_<43 base64url chars from 32 random bytes>
 * Example: alola_tk_9fQrq3Nf4J5Wz_Abc123Def456Ghi789Jkl012MnoPqr
 *
 * `key_prefix` stored in the DB is the FIRST 16 chars:
 *   "alola_tk_" (9)  +  7 random chars
 * That's enough to make DB lookup O(1) while leaving 36 random chars for the
 * secret portion compared via bcrypt.
 */
const PREFIX_LEN = 16

export function generateKey(): { plaintext: string; prefix: string; hash: string } {
  const body = randomBytes(32).toString('base64url')
  const plaintext = `${BEARER_PREFIX}${body}`
  const prefix = plaintext.slice(0, PREFIX_LEN)
  const hash = bcrypt.hashSync(plaintext, 12)
  return { plaintext, prefix, hash }
}

/** Extract the lookup prefix from a caller's bearer token. Returns null if malformed. */
export function extractPrefix(token: string): string | null {
  if (!token.startsWith(BEARER_PREFIX)) return null
  if (token.length <= PREFIX_LEN) return null  // not enough body
  return token.slice(0, PREFIX_LEN)
}

/** Constant-time-ish compare (bcrypt internally). */
export async function verifyKey(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}
