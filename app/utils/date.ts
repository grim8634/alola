// app/utils/date.ts — client-side date helpers (browser local tz).
// Dates are stored as unix seconds. Due dates are date-only; we treat due_at as
// the START OF THE DUE DAY in user's tz (backend decides; client just displays).

export function startOfToday(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

export function startOfTomorrow(now = new Date()): number {
  return startOfToday(now) + 86400
}

export function startOfNextWeek(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()  // Sun=0..Sat=6
  const daysUntilMon = (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntilMon)
  return Math.floor(d.getTime() / 1000)
}

export function formatDueLabel(dueAt: number | null, now = new Date()): {
  label: string
  tone: 'overdue' | 'today' | 'soon' | 'future' | 'none'
} {
  if (dueAt === null) return { label: '', tone: 'none' }
  const today = startOfToday(now)
  const tomorrow = today + 86400
  const sevenDays = today + 7 * 86400

  if (dueAt < today) {
    const daysOverdue = Math.floor((today - dueAt) / 86400)
    return {
      label: daysOverdue === 1 ? 'Yesterday' : `${daysOverdue} days overdue`,
      tone: 'overdue',
    }
  }
  if (dueAt < tomorrow) return { label: 'Today', tone: 'today' }
  if (dueAt < tomorrow + 86400) return { label: 'Tomorrow', tone: 'soon' }

  const d = new Date(dueAt * 1000)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  if (dueAt < sevenDays) return { label: `${weekday} ${day} ${month}`, tone: 'soon' }
  return { label: `${weekday} ${day} ${month}`, tone: 'future' }
}

/** Returns a due_at unix seconds value for "today" (start of day local tz). */
export function todayAsDueAt(now = new Date()): number {
  return startOfToday(now)
}
