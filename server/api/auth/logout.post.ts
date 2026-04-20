// server/api/auth/logout.post.ts
import { defineEventHandler, setResponseStatus } from 'h3'
import { endSession } from '../../utils/auth'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'

export default defineEventHandler(async (event) => {
  // Cookie-only. A bearer key must not be able to revoke sessions.
  requireCookieAuth(event)
  verifyCsrf(event)
  await endSession(event)
  setResponseStatus(event, 204)
  return null
})
