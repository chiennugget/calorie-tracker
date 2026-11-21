import { describe, expect, it } from 'vitest'
import { addDays } from './date'
import {
  adaptiveCalorieGoal,
  estimateTdee,
  projectGoalDate,
  recentFoods,
  recentMeals,
  shouldRemindBackup,
  usualFoods,
  weekBudget,
  weekOf,
} from './insights'
import { Store } from './store'
import type { MealSlot } from './types'

const n = (calories: number, protein = 0, carbs = 0, fat = 0) => ({ calories, protein, carbs, fat })
const log = (s: Store, date: string, calories: number, slot: MealSlot = 'lunch', name = 'Food') =>
  s.addEntry({ date, slot, name, nutrients: n(calories), servings: 1, source: 'quick' })

describe('weekBudget', () => {
  // 2026-11-16 is a Monday.
  it('uses a Monday-start week', () => {
    expect(weekOf('2026-11-21')[0]).toBe('2026-11-16')
    expect(weekOf('2026-11-16')[6]).toBe('2026-11-22')
  })

  it('spreads what is left over the remaining days', () => {
    const s = new Store()
    s.updateSettings({ goals: { ...s.getState().settings.goals, calories: 2000 } })
    log(s, '2026-11-16', 2500)
    log(s, '2026-11-17', 2500)
    const w = weekBudget(s.getState(), '2026-11-18')
    expect(w.budget).toBe(14000)
    expect(w.eaten).toBe(5000)
    expect(w.daysLeft).toBe(5)
    expect(w.perDayLeft).toBe(1800) // (14000 - 5000) / 5
    expect(w.skippedDays).toBe(0)
  })

  it('leaves unlogged past days out instead of counting them as zero', () => {
    const s = new Store()
    log(s, '2026-11-16', 2000)
    const w = weekBudget(s.getState(), '2026-11-19') // Tue and Wed not logged
    expect(w.skippedDays).toBe(2)
    expect(w.budget).toBe(2000 * 5)
  })
})

describe('estimateTdee', () => {
  it('needs enough data', () => {
    const s = new Store()
    log(s, '2026-11-21', 2000)
    expect(estimateTdee(s.getState(), '2026-11-21')).toBeNull()
  })

  it('infers maintenance from intake and trend slope', () => {
    const s = new Store()
    const end = '2026-11-28'
    // 28 days at 2000 kcal while losing exactly 0.1 kg/day of trend weight
    // (weigh-ins every day, alpha smoothing ≈ same slope after warm-up).
    for (let i = 0; i < 28; i++) {
      const d = addDays(end, -27 + i)
      log(s, d, 2000)
    }
    // Use many prior days so the smoothed trend is already following a steady line.
    for (let i = 0; i < 90; i++) {
      const d = addDays(end, -89 + i)
      s.logWeight({ date: d, weightKg: 100 - i * 0.1 })
    }
    const est = estimateTdee(s.getState(), end)!
    expect(est.avgIntake).toBe(2000)
    expect(est.kgPerWeek).toBeCloseTo(-0.7, 1)
    // 2000 + 0.1 * 7700 = 2770
    expect(est.tdee).toBeGreaterThan(2700)
    expect(est.tdee).toBeLessThan(2840)
  })

  it('sets a goal from measured maintenance with a safety floor', () => {
    expect(adaptiveCalorieGoal(2500, { goal: 'lose', ratePerWeekKg: 0.5, sex: 'male' })).toBe(1950)
    expect(adaptiveCalorieGoal(1500, { goal: 'lose', ratePerWeekKg: 1, sex: 'female' })).toBe(1200)
    expect(adaptiveCalorieGoal(2500, { goal: 'gain', ratePerWeekKg: 0.25, sex: 'male' })).toBe(2780)
  })
})

describe('projectGoalDate', () => {
  const withProfile = (goalWeightKg: number) => {
    const s = new Store()
    s.updateSettings({
      profile: { sex: 'male', age: 30, heightCm: 175, activity: 'light', goal: 'lose', ratePerWeekKg: 0.5, goalWeightKg },
    })
    return s
  }

  it('projects a date when heading toward the goal', () => {
    const s = withProfile(85)
    const end = '2026-11-28'
    for (let i = 0; i < 90; i++) s.logWeight({ date: addDays(end, -89 + i), weightKg: 100 - i * (0.5 / 7) })
    const p = projectGoalDate(s.getState(), end)!
    expect(p).not.toBeNull()
    expect(p.kgPerWeek).toBeCloseTo(-0.5, 1)
    expect(p.date > end).toBe(true)
  })

  it('returns null when moving away from the goal', () => {
    const s = withProfile(70)
    const end = '2026-11-28'
    for (let i = 0; i < 30; i++) s.logWeight({ date: addDays(end, -29 + i), weightKg: 80 + i * 0.05 })
    expect(projectGoalDate(s.getState(), end)).toBeNull()
  })
})

describe('faster logging', () => {
  it('ranks usual foods for a meal by frequency', () => {
    const s = new Store()
    log(s, '2026-11-18', 350, 'breakfast', 'Kaya toast set')
    log(s, '2026-11-19', 350, 'breakfast', 'Kaya toast set')
    log(s, '2026-11-20', 350, 'breakfast', 'Kaya toast set')
    log(s, '2026-11-20', 120, 'breakfast', 'Kopi C')
    log(s, '2026-11-21', 120, 'breakfast', 'kopi c ')
    log(s, '2026-11-21', 600, 'lunch', 'Chicken rice')
    const usual = usualFoods(s.getState(), 'breakfast')
    expect(usual.map((u) => u.entry.name.trim().toLowerCase())).toEqual(['kaya toast set', 'kopi c'])
    expect(usualFoods(s.getState(), 'lunch')).toEqual([])
    expect(recentFoods(s.getState(), 'lunch')).toHaveLength(3)
  })

  it('finds recent multi-item meals and dedupes repeats', () => {
    const s = new Store()
    for (const d of ['2026-11-19', '2026-11-20']) {
      log(s, d, 350, 'breakfast', 'Kaya toast set')
      log(s, d, 120, 'breakfast', 'Kopi C')
    }
    log(s, '2026-11-20', 600, 'lunch', 'Chicken rice') // single item: not a "meal"
    const meals = recentMeals(s.getState(), '2026-11-21')
    expect(meals).toHaveLength(1)
    expect(meals[0].date).toBe('2026-11-20')
    expect(meals[0].calories).toBe(470)
  })

  it('copies a meal to another day and slot and can undo it', () => {
    const s = new Store()
    log(s, '2026-11-20', 350, 'breakfast', 'A')
    log(s, '2026-11-20', 120, 'breakfast', 'B')
    const copies = s.copyEntries('2026-11-20', '2026-11-22', 'breakfast', 'snacks')
    expect(copies.map((c) => [c.date, c.slot, c.name])).toEqual([
      ['2026-11-22', 'snacks', 'A'],
      ['2026-11-22', 'snacks', 'B'],
    ])
    s.deleteEntries(copies.map((c) => c.id))
    expect(s.getState().entries).toHaveLength(2)
  })
})

describe('backup reminder', () => {
  const DAY = 864e5
  const now = new Date(2026, 10, 21).getTime()

  it('stays quiet for new users and nags after two weeks without a backup', () => {
    const s = new Store()
    expect(shouldRemindBackup(s.getState(), now)).toBe(false)
    for (let i = 0; i < 20; i++) log(s, '2026-11-01', 100)
    const d = s.getState()
    const old = { ...d, entries: d.entries.map((e) => ({ ...e, createdAt: now - 20 * DAY })) }
    expect(shouldRemindBackup(old, now)).toBe(true)
    expect(shouldRemindBackup({ ...old, meta: { ...old.meta, lastBackupAt: now - 3 * DAY } }, now)).toBe(false)
    expect(shouldRemindBackup({ ...old, meta: { ...old.meta, lastBackupAt: now - 15 * DAY } }, now)).toBe(true)
    expect(
      shouldRemindBackup({ ...old, meta: { ...old.meta, lastBackupAt: now - 30 * DAY, backupReminderDismissedAt: now - DAY } }, now),
    ).toBe(false)
  })
})
