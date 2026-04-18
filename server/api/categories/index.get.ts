import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { rows } = await db().execute({
    sql: `SELECT id, name, color, position, created_at, updated_at
          FROM categories WHERE user_id = ?
          ORDER BY position ASC, created_at ASC`,
    args: [userId],
  })
  return {
    categories: rows.map(r => ({
      id: Number(r.id),
      name: r.name as string,
      color: r.color as string,
      position: Number(r.position),
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    })),
  }
})
