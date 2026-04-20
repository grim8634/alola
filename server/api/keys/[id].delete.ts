// server/api/keys/[id].delete.ts — soft-revoke an API key.
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const now = Math.floor(Date.now() / 1000)
  const res = await db().execute({
    sql: `UPDATE api_keys SET revoked_at = ?
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    args: [now, id, userId],
  })
  if (res.rowsAffected === 0) throwApiError('not_found', 'key not found or already revoked')

  setResponseStatus(event, 204)
  return null
})
