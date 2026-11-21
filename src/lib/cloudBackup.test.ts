import { describe, expect, it } from 'vitest'
import { backupSignature, dataSize, describeBackup, retryDelayMs, shouldAutoUpload, snapshotsToPrune } from './cloudBackup'
import { addDays, formatAgo } from './date'
import { Store } from './store'
import { emptyData } from './types'

function withData(entries: number, weighIns = 0, onboarded = true) {
  const s = new Store()
  for (let i = 0; i < entries; i++) {
    s.addEntry({ date: addDays('2026-11-21', -i), slot: 'lunch', name: `Meal ${i}`, nutrients: { calories: 500, protein: 20, carbs: 50, fat: 15 }, servings: 1, source: 'quick' })
  }
  for (let i = 0; i < weighIns; i++) s.logWeight({ date: addDays('2026-11-21', -i), weightKg: 80 - i / 10 })
  s.updateMeta({ onboarded })
  return s.getState()
}

describe('shouldAutoUpload (wipe safeguard)', () => {
  it('never uploads before onboarding, even with no cloud backup', () => {
    expect(shouldAutoUpload(emptyData(), undefined)).toEqual({ ok: false, reason: 'not-onboarded' })
    expect(shouldAutoUpload(withData(5, 0, false), 100)).toEqual({ ok: false, reason: 'not-onboarded' })
  })

  it('uploads normally when there is no cloud backup yet', () => {
    expect(shouldAutoUpload(withData(0), undefined)).toEqual({ ok: true })
    expect(shouldAutoUpload(withData(3), undefined)).toEqual({ ok: true })
  })

  it('refuses to replace a cloud backup with an empty diary', () => {
    expect(shouldAutoUpload(withData(0), 4)).toEqual({ ok: false, reason: 'empty' })
    // Both empty is harmless.
    expect(shouldAutoUpload(withData(0), 0)).toEqual({ ok: true })
  })

  it('refuses when local data has shrunk to under half of the cloud copy', () => {
    expect(shouldAutoUpload(withData(4), 100)).toEqual({ ok: false, reason: 'shrunk' })
    expect(shouldAutoUpload(withData(49), 100)).toEqual({ ok: false, reason: 'shrunk' })
    expect(shouldAutoUpload(withData(50), 100)).toEqual({ ok: true })
    expect(shouldAutoUpload(withData(30, 30), 100)).toEqual({ ok: true })
  })

  it('ignores shrinkage on tiny backups, where deleting a few entries is normal', () => {
    expect(shouldAutoUpload(withData(1), 9)).toEqual({ ok: true })
    expect(shouldAutoUpload(withData(1), 10)).toEqual({ ok: false, reason: 'shrunk' })
  })

  it('counts entries and weigh-ins', () => {
    expect(dataSize(withData(3, 2))).toBe(5)
  })
})

describe('backupSignature', () => {
  it('ignores housekeeping so recording a backup does not trigger another upload', () => {
    const d = withData(2)
    expect(backupSignature({ ...d, meta: { ...d.meta, lastBackupAt: 123 } })).toBe(backupSignature(d))
  })

  it('changes when diary data changes', () => {
    const d = withData(2)
    expect(backupSignature({ ...d, water: { '2026-11-21': 250 } })).not.toBe(backupSignature(d))
  })
})

describe('snapshotsToPrune', () => {
  const today = '2026-11-21'
  const daily = (from: string, count: number) => Array.from({ length: count }, (_, i) => addDays(from, -i))

  it('keeps every snapshot from the last 30 days', () => {
    expect(snapshotsToPrune(daily(today, 30), today)).toEqual([])
  })

  it('keeps only the newest snapshot of each older month', () => {
    const days = daily(today, 120) // back to late July
    const pruned = new Set(snapshotsToPrune(days, today))
    const kept = days.filter((d) => !pruned.has(d)).sort()
    const old = kept.filter((d) => d < addDays(today, -29))
    // Newest per month before the 30-day window: Jul 31, Aug 31, Sep 30 and Oct 22 (the day before the window).
    expect(old).toEqual(['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-22'])
    expect(kept.length).toBe(30 + old.length)
  })

  it('handles gaps and year boundaries', () => {
    const days = ['2026-01-02', '2025-12-31', '2025-12-01', '2025-11-15']
    expect(snapshotsToPrune(days, '2026-11-21').sort()).toEqual(['2025-12-01'])
  })

  it('does nothing with no snapshots', () => {
    expect(snapshotsToPrune([], today)).toEqual([])
  })
})

describe('retryDelayMs', () => {
  it('backs off exponentially up to 30 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map((f) => retryDelayMs(f) / 60_000)).toEqual([1, 2, 4, 8, 16, 30, 30])
  })
})

describe('describeBackup', () => {
  it('summarises counts and the date range', () => {
    expect(describeBackup(withData(3, 1))).toBe('3 diary entries · 1 weigh-in · 2026-11-19 to 2026-11-21')
    expect(describeBackup(emptyData())).toBe('0 diary entries · 0 weigh-ins')
  })
})

describe('formatAgo', () => {
  it('reads naturally at each scale', () => {
    const now = 1_000_000_000_000
    expect([0, 59, 60, 3599, 3600, 86399, 86400, 3 * 86400].map((s) => formatAgo(now - s * 1000, now))).toEqual([
      'just now',
      'just now',
      '1 min ago',
      '59 min ago',
      '1 h ago',
      '23 h ago',
      '1 day ago',
      '3 days ago',
    ])
  })
})
