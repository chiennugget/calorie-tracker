import { describe, expect, it } from 'vitest'
import { parseData, serialiseData, type StorageAdapter } from './storage'
import { Store } from './store'
import { DATA_VERSION, emptyData } from './types'

const v1 = {
  version: 1,
  entries: [
    { id: 'a', date: '2026-11-20', slot: 'lunch', name: 'Laksa', nutrients: { calories: 600, protein: 20, carbs: 60, fat: 30 }, servings: 1, source: 'quick', createdAt: 1 },
  ],
  savedMeals: [],
  weighIns: [{ date: '2026-11-20', weightKg: 70 }],
  exercise: [],
  water: { '2026-11-20': 500 },
  settings: { weightUnit: 'kg', waterUnit: 'ml', goals: { calories: 1800, protein: 120, carbs: 180, fat: 60, waterMl: 2000 } },
}

describe('migration', () => {
  it('upgrades v1 data to the current version and keeps everything', () => {
    const d = parseData(JSON.stringify(v1))
    expect(d.version).toBe(DATA_VERSION)
    expect(d.meta.onboarded).toBe(true)
    expect(d.entries).toHaveLength(1)
    expect(d.entries[0].name).toBe('Laksa')
    expect(d.settings.goals.calories).toBe(1800)
    expect(d.water['2026-11-20']).toBe(500)
  })

  it('round-trips current data', () => {
    const d = emptyData()
    d.weighIns.push({ date: '2026-11-21', weightKg: 70 })
    d.meta.lastBackupAt = 123
    expect(parseData(serialiseData(d))).toEqual(d)
  })

  it('rejects garbage and backups from newer versions', () => {
    expect(() => parseData('{"foo":1}')).toThrow()
    expect(() => parseData('[]')).toThrow()
    expect(() => parseData(JSON.stringify({ ...v1, version: DATA_VERSION + 1 }))).toThrow(/newer/)
  })

  it('drops corrupt rows and coerces bad numbers instead of crashing', () => {
    const d = parseData(
      JSON.stringify({
        ...v1,
        entries: [
          ...v1.entries,
          { date: 'yesterday', slot: 'lunch', name: 'bad date' },
          { date: '2026-11-20', slot: 'brunch', name: 'bad slot' },
          { date: '2026-11-20', slot: 'dinner', name: 'Kopi', nutrients: { calories: '120', protein: null }, servings: -2 },
        ],
        weighIns: [{ date: '2026-11-20', weightKg: 70 }, { date: '2026-11-20', weightKg: 69 }, { date: '2026-11-21', weightKg: 0 }],
        water: { '2026-11-20': 500, nope: 3 },
      }),
    )
    expect(d.entries.map((e) => e.name)).toEqual(['Laksa', 'Kopi'])
    expect(d.entries[1].nutrients).toEqual({ calories: 120, protein: 0, carbs: 0, fat: 0 })
    expect(d.entries[1].servings).toBe(1)
    expect(d.entries[1].id).toBeTruthy()
    expect(d.weighIns).toEqual([{ date: '2026-11-20', weightKg: 69 }])
    expect(Object.keys(d.water)).toEqual(['2026-11-20'])
  })
})

describe('store persistence', () => {
  it('reports save failures and keeps working in memory', () => {
    const failing: StorageAdapter = {
      load: () => null,
      save: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const s = new Store(failing)
    const errors: unknown[] = []
    s.setSaveErrorHandler((e) => errors.push(e))
    s.addWater('2026-11-21', 250)
    expect(errors).toHaveLength(1)
    expect(s.saveFailed).toBe(true)
    expect(s.getState().water['2026-11-21']).toBe(250)
  })

  it('marks restored backups as onboarded and backed up', () => {
    const s = new Store()
    s.replaceAll(emptyData())
    expect(s.getState().meta.onboarded).toBe(true)
    expect(s.getState().meta.lastBackupAt).toBeTypeOf('number')
  })
})
