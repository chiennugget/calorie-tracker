// Cloud backup rules: what to upload, when it's safe, and which snapshots to keep.
// Pure TypeScript (no DOM, no Supabase) so the same rules apply on React Native.
import { addDays } from './date'
import type { AppData, DateKey } from './types'

/** One stored snapshot. There's at most one per local day; later uploads that day replace it. */
export interface SnapshotInfo {
  day: DateKey
  /** ms epoch of the last upload to this snapshot */
  updatedAt: number
  entryCount: number
  weighInCount: number
  dataVersion: number
}

/** Where snapshots go. Supabase today; anything with these four calls works. */
export interface BackupTarget {
  upsert(day: DateKey, data: AppData): Promise<void>
  /** Newest first. */
  list(): Promise<SnapshotInfo[]>
  /** Raw JSON, to be checked with `parseData` before use. */
  get(day: DateKey): Promise<string>
  remove(days: DateKey[]): Promise<void>
}

/** How much diary data there is, for comparing local data against the cloud. */
export const dataSize = (d: Pick<AppData, 'entries' | 'weighIns'>): number => d.entries.length + d.weighIns.length

/** Everything except housekeeping, so recording "backed up at" doesn't itself trigger another upload. */
export function backupSignature(data: AppData): string {
  const { meta: _meta, ...rest } = data
  return JSON.stringify(rest)
}

export type UploadBlock = 'not-onboarded' | 'empty' | 'shrunk'
export type UploadDecision = { ok: true } | { ok: false; reason: UploadBlock }

/** Below this, a drop in size isn't treated as suspicious. */
const SHRINK_MIN = 10

/**
 * The wipe safeguard. A browser that lost its data looks like a fresh install,
 * and uploading that would bury the good backup, so automatic uploads stop when
 * the local data looks wiped compared with the newest cloud snapshot.
 * `remoteSize` is the newest snapshot's `dataSize`, or undefined if there's none.
 */
export function shouldAutoUpload(data: AppData, remoteSize: number | undefined): UploadDecision {
  if (!data.meta.onboarded) return { ok: false, reason: 'not-onboarded' }
  const size = dataSize(data)
  if (size === 0 && (remoteSize ?? 0) > 0) return { ok: false, reason: 'empty' }
  if (remoteSize !== undefined && remoteSize >= SHRINK_MIN && size < remoteSize * 0.5) return { ok: false, reason: 'shrunk' }
  return { ok: true }
}

export const BLOCK_MESSAGES: Record<UploadBlock, string> = {
  'not-onboarded': 'Automatic backup starts once you’ve set up the app or restored a backup.',
  empty: 'This device has no diary data, but your cloud backup does. Restore it, or back up anyway to start fresh.',
  shrunk: 'This device has much less data than your last cloud backup. Restore it, or back up anyway if you deleted entries on purpose.',
}

/**
 * Retention: keep every snapshot from the last `keepDays` days, then only the
 * newest snapshot of each older month. Returns the days to delete.
 */
export function snapshotsToPrune(days: DateKey[], todayKey: DateKey, keepDays = 30): DateKey[] {
  const cutoff = addDays(todayKey, -(keepDays - 1))
  const newestPerMonth = new Map<string, DateKey>()
  for (const d of days) {
    if (d >= cutoff) continue
    const month = d.slice(0, 7)
    const cur = newestPerMonth.get(month)
    if (!cur || d > cur) newestPerMonth.set(month, d)
  }
  const keep = new Set(newestPerMonth.values())
  return days.filter((d) => d < cutoff && !keep.has(d))
}

/** Retry delay after a failed upload: 1, 2, 4… minutes, capped at 30. */
export function retryDelayMs(failures: number): number {
  return Math.min(30, 2 ** Math.max(0, failures - 1)) * 60_000
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

/** A one-line summary shown before restoring, e.g. "312 diary entries · 45 weigh-ins · 3 Jan – 20 Nov 2026". */
export function describeBackup(data: AppData): string {
  const parts = [plural(data.entries.length, 'diary entry', 'diary entries'), plural(data.weighIns.length, 'weigh-in')]
  if (data.savedMeals.length) parts.push(plural(data.savedMeals.length, 'saved meal'))
  const dates = [...data.entries.map((e) => e.date), ...data.weighIns.map((w) => w.date)].sort()
  if (dates.length) parts.push(dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} to ${dates.at(-1)}`)
  return parts.join(' · ')
}
