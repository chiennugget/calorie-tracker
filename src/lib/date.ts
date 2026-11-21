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
