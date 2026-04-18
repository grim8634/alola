// server/api/auth/logout.post.ts
import { defineEventHandler, setResponseStatus } from 'h3'
import { endSession } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'

export default defineEventHandler(async (event) => {
  // Logout is cookie-auth only. If there is no session, it's still safe to
  // no-op. If there is, we require a valid CSRF token.
  if (event.context.auth?.authMethod === 'cookie') {
    verifyCsrf(event)
  }
  await endSession(event)
  setResponseStatus(event, 204)
  return null
})
