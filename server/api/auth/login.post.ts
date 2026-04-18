import { defineEventHandler, readBody, getHeader, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import { db } from '../../utils/db'
import { startSession, purgeExpiredSessions } from '../../utils/auth'
import { throwApiError, requireField } from '../../utils/errors'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'

// Bogus but real-format bcrypt hash used when the email doesn't exist, so
// compare time matches the real-user path. Computed at module load once.
const UNREACHABLE_HASH = bcrypt.hashSync('\0', 12)

interface LoginBody {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  // Per-IP rate limit (5/min) — before we know who the user is.
  const ip =
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getHeader(event, 'x-real-ip') ??
    'unknown'
  rateLimit(`login:${ip}`, RATE_LIMITS.login)

  const body = await readBody<LoginBody>(event)
  const email = requireField(body?.email?.trim().toLowerCase(), 'email')
  const password = requireField(body?.password, 'password')

  const { rows } = await db().execute({
    sql: 'SELECT id, password_hash FROM users WHERE email = ?',
    args: [email],
  })

  // Compare against a real-format hash even if the user doesn't exist, so
  // timing doesn't leak whether an email is registered.
  const hash = (rows[0]?.password_hash as string) ?? UNREACHABLE_HASH
  const ok = await bcrypt.compare(password, hash)
  if (!ok || rows.length === 0) {
    throwApiError('auth_required', 'Invalid email or password')
  }

  const userId = Number(rows[0].id)
  await purgeExpiredSessions()
  await startSession(event, userId)

  setResponseStatus(event, 204)
  return null
})
