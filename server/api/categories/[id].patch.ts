import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { optionalString, optionalInt, requireHexColor } from '../../utils/validation'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId, authMethod } = requireAuth(event)
  if (authMethod === 'cookie') verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const body = await readBody(event)
  const name = optionalString(body?.name, 'name', { max: 60 })
  const color = body?.color !== undefined && body?.color !== null ? requireHexColor(body.color, 'color') : undefined
  const position = optionalInt(body?.position, 'position', { min: 0 })

  const sets: string[] = []
  const args: unknown[] = []
  if (name !== undefined)     { sets.push('name = ?');     args.push(name) }
  if (color !== undefined)    { sets.push('color = ?');    args.push(color) }
  if (position !== undefined) { sets.push('position = ?'); args.push(position) }
  if (sets.length === 0) throwApiError('validation_failed', 'no fields to update')

  sets.push('updated_at = ?')
  args.push(Math.floor(Date.now() / 1000))

  args.push(id, userId)
  try {
    const res = await db().execute({
      sql: `UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING id, name, color, position, created_at, updated_at`,
      args,
    })
    if (res.rows.length === 0) throwApiError('not_found', 'category not found')
    const r = res.rows[0]
    return {
      category: {
        id: Number(r.id),
        name: r.name as string,
        color: r.color as string,
        position: Number(r.position),
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at),
      },
    }
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throwApiError('validation_failed', `a category with that name already exists`)
    }
    throw e
  }
})
