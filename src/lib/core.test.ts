import { describe, expect, it } from 'vitest'
import { addDays, lastNDays } from './date'
import { parseProduct } from './foodApi'
import { caloriesFromMacros, daySummary, loggingStreak, suggestGoals, sumEntries, tdee, trendWeights } from './nutrition'
import { diaryToCsv, parseData, serialiseData } from './storage'
import { Store } from './store'
import { emptyData } from './types'

const n = (calories: number, protein = 0, carbs = 0, fat = 0) => ({ calories, protein, carbs, fat })

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('lists last N days inclusive', () => {
    expect(lastNDays('2026-11-21', 3)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21'])
  })
})

describe('store', () => {
  it('quick adds, sums servings and tracks saved meal use', () => {
    const s = new Store()
    const meal = s.saveMeal({ name: 'Chicken rice', nutrients: n(600, 45, 70, 12) })
    s.addEntry({ date: '2026-11-21', slot: 'lunch', name: 'Chicken rice', nutrients: meal.nutrients, servings: 1.5, source: 'saved', savedMealId: meal.id })
    s.addEntry({ date: '2026-11-21', slot: 'dinner', name: 'Takeaway', nutrients: n(900, 30, 100, 40), servings: 1, source: 'quick' })
    const total = sumEntries(s.getState().entries)
    expect(total.calories).toBe(1800)
    expect(total.protein).toBeCloseTo(97.5)
    expect(s.getState().savedMeals[0].useCount).toBe(1)
  })

  it('keeps one weigh-in per day', () => {
    const s = new Store()
    s.logWeight({ date: '2026-11-21', weightKg: 80 })
    s.logWeight({ date: '2026-11-21', weightKg: 79.5 })
    expect(s.getState().weighIns).toEqual([{ date: '2026-11-21', weightKg: 79.5 }])
  })

  it('copies a meal from yesterday', () => {
    const s = new Store()
    s.addEntry({ date: '2026-11-20', slot: 'breakfast', name: 'Oats', nutrients: n(350), servings: 1, source: 'quick' })
    expect(s.copyEntries('2026-11-20', '2026-11-21', 'breakfast')).toBe(1)
    expect(s.getState().entries.filter((e) => e.date === '2026-11-21')).toHaveLength(1)
  })

  it('does not add exercise to remaining calories', () => {
    const s = new Store()
    s.addEntry({ date: '2026-11-21', slot: 'lunch', name: 'x', nutrients: n(1500), servings: 1, source: 'quick' })
    s.addExercise({ date: '2026-11-21', name: 'Run', calories: 300 })
    const day = daySummary(s.getState(), '2026-11-21')
    expect(day.remaining).toBe(500)
    expect(day.exercise).toBe(300)
  })

  it('counts logging streak', () => {
    const s = new Store()
    for (const d of ['2026-11-18', '2026-11-19', '2026-11-20']) s.addEntry({ date: d, slot: 'lunch', name: 'x', nutrients: n(1), servings: 1, source: 'quick' })
    expect(loggingStreak(s.getState(), '2026-11-21')).toBe(3)
    expect(loggingStreak(s.getState(), '2026-11-23')).toBe(0)
  })
})

describe('nutrition', () => {
  it('computes kcal from macros', () => {
    expect(caloriesFromMacros({ protein: 30, carbs: 50, fat: 10 })).toBe(410)
  })
  it('computes TDEE and suggested goals', () => {
    const p = { sex: 'male' as const, age: 30, heightCm: 180, activity: 'moderate' as const, goal: 'lose' as const, ratePerWeekKg: 0.5 }
    expect(Math.round(tdee(p, 80))).toBe(Math.round((800 + 1125 - 150 + 5) * 1.55))
    const g = suggestGoals(p, 80)
    expect(g.calories).toBeLessThan(tdee(p, 80))
    expect(g.protein).toBe(160)
    expect(Math.abs(caloriesFromMacros(g) - g.calories)).toBeLessThan(10)
  })
  it('smooths weight trend', () => {
    const t = trendWeights([{ date: '2026-11-02', weightKg: 82 }, { date: '2026-11-01', weightKg: 80 }])
    expect(t[0].trend).toBe(80)
    expect(t[1].trend).toBeCloseTo(80.2)
  })
})

describe('open food facts parsing', () => {
  it('parses kcal and derives per-serving values', () => {
    const p = parseProduct({ code: '1', product_name: 'Yogurt', brands: 'Acme, Other', serving_quantity: 150, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 0.2 } })
    expect(p?.brand).toBe('Acme')
    expect(p?.perServing?.calories).toBe(90)
    expect(p?.perServing?.protein).toBe(15)
  })
  it('falls back to kJ and rejects incomplete products', () => {
    expect(parseProduct({ code: '2', product_name: 'Bar', nutriments: { energy_100g: 418.4 } })?.per100g.calories).toBe(100)
    expect(parseProduct({ code: '3', product_name: 'No data', nutriments: {} })).toBeNull()
  })
})

describe('backup', () => {
  it('round-trips and rejects garbage', () => {
    const d = emptyData()
    d.weighIns.push({ date: '2026-11-21', weightKg: 70 })
    expect(parseData(serialiseData(d))).toEqual(d)
    expect(() => parseData('{"foo":1}')).toThrow()
  })
  it('exports CSV with escaped names', () => {
    const s = new Store()
    s.addEntry({ date: '2026-11-21', slot: 'dinner', name: 'Mum\'s "famous" pie', nutrients: n(500, 20, 50, 25), servings: 2, source: 'quick' })
    expect(diaryToCsv(s.getState()).split('\n')[1]).toBe('2026-11-21,dinner,"Mum\'s ""famous"" pie",2,1000,40,100,50')
  })
})
