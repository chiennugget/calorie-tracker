import type { DateKey } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): DateKey {
  return toDateKey(new Date())
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** Inclusive list of date keys ending at `end`, `count` days long. */
export function lastNDays(end: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1))
}

export function formatDayLabel(key: DateKey, now: DateKey = today()): string {
  if (key === now) return 'Today'
  if (key === addDays(now, -1)) return 'Yesterday'
  if (key === addDays(now, 1)) return 'Tomorrow'
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatShort(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}
