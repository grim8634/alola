// server/utils/datetime.ts — timezone-aware day boundaries in unix seconds.
// All *InTz helpers take an IANA tz string like 'Europe/London'.

/** Unix seconds at midnight today in `tz`. */
export function startOfTodayInTz(tz: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const pick = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const hour = pick('hour') % 24  // formatToParts may emit '24' at midnight in some runtimes
  const msIntoDay = ((hour * 60 + pick('minute')) * 60 + pick('second')) * 1000 + now.getMilliseconds()
  return Math.floor((now.getTime() - msIntoDay) / 1000)
}

/** Unix seconds at midnight N days after today in `tz`. */
export function startOfDayPlusInTz(tz: string, daysOffset: number, now: Date = new Date()): number {
  return startOfTodayInTz(tz, now) + daysOffset * 86400
}

/** Unix seconds at midnight at the start of next calendar week (Monday), in `tz`. */
export function startOfNextWeekInTz(tz: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' })
  const weekday = fmt.format(now)  // 'Mon' | 'Tue' | ...
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const daysUntilMon = (7 - order.indexOf(weekday)) % 7 || 7
  return startOfDayPlusInTz(tz, daysUntilMon, now)
}
