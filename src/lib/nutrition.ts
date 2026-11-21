import { addDays, lastNDays } from './date'
import type {
  ActivityLevel,
  AppData,
  DateKey,
  FoodEntry,
  Goals,
  MealSlot,
  Nutrients,
  Profile,
  WeighIn,
} from './types'
import { ZERO } from './types'

export const KG_PER_LB = 0.45359237
export const ML_PER_OZ = 29.5735
const KCAL_PER_KG_FAT = 7700

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB

export function addNutrients(a: Nutrients, b: Nutrients, factor = 1): Nutrients {
  return {
    calories: a.calories + b.calories * factor,
    protein: a.protein + b.protein * factor,
    carbs: a.carbs + b.carbs * factor,
    fat: a.fat + b.fat * factor,
  }
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return addNutrients(ZERO, n, factor)
}

export function entryTotal(e: FoodEntry): Nutrients {
  return scaleNutrients(e.nutrients, e.servings)
}

export function sumEntries(entries: FoodEntry[]): Nutrients {
  return entries.reduce((acc, e) => addNutrients(acc, e.nutrients, e.servings), { ...ZERO })
}

export function entriesFor(data: AppData, date: DateKey, slot?: MealSlot): FoodEntry[] {
  return data.entries.filter((e) => e.date === date && (!slot || e.slot === slot))
}

export function exerciseCalories(data: AppData, date: DateKey): number {
  return data.exercise.filter((x) => x.date === date).reduce((s, x) => s + x.calories, 0)
}

export interface DaySummary {
  date: DateKey
  food: Nutrients
  exercise: number
  goal: number
  remaining: number
  water: number
  logged: boolean
}

export function daySummary(data: AppData, date: DateKey): DaySummary {
  const dayEntries = entriesFor(data, date)
  const food = sumEntries(dayEntries)
  const exercise = exerciseCalories(data, date)
  const goal = data.settings.goals.calories
  return {
    date,
    food,
    exercise,
    goal,
    remaining: goal - food.calories,
    water: data.water[date] ?? 0,
    logged: dayEntries.length > 0,
  }
}

/** Consecutive days (ending today or yesterday) with at least one food entry. */
export function loggingStreak(data: AppData, todayKey: DateKey): number {
  const logged = new Set(data.entries.map((e) => e.date))
  let day = logged.has(todayKey) ? todayKey : addDays(todayKey, -1)
  let streak = 0
  while (logged.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

export function averageCalories(data: AppData, end: DateKey, days: number): number | null {
  const sums = lastNDays(end, days)
    .map((d) => daySummary(data, d))
    .filter((s) => s.logged)
  if (!sums.length) return null
  return sums.reduce((s, d) => s + d.food.calories, 0) / sums.length
}

// ---------- Weight ----------

export function sortedWeighIns(weighIns: WeighIn[]): WeighIn[] {
  return [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Exponentially-smoothed trend weight (like the "trend" line in Libra / Happy Scale).
 * Smooths out day-to-day water fluctuations.
 */
export function trendWeights(weighIns: WeighIn[], alpha = 0.1): { date: DateKey; weight: number; trend: number }[] {
  const sorted = sortedWeighIns(weighIns)
  let trend: number | undefined
  return sorted.map((w) => {
    trend = trend === undefined ? w.weightKg : trend + alpha * (w.weightKg - trend)
    return { date: w.date, weight: w.weightKg, trend }
  })
}

// ---------- TDEE / goals ----------

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, little exercise)',
  light: 'Lightly active (1–3 workouts/week)',
  moderate: 'Moderately active (3–5 workouts/week)',
  active: 'Very active (6–7 workouts/week)',
  very_active: 'Extremely active (physical job + training)',
}

/** Mifflin–St Jeor basal metabolic rate. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.sex === 'male' ? base + 5 : base - 161
}

export function tdee(p: Profile, weightKg: number): number {
  return bmr(p, weightKg) * ACTIVITY_FACTORS[p.activity]
}

/**
 * Suggests calorie + macro goals.
 * Protein: 2.0 g/kg (cutting) or 1.8 g/kg otherwise. Fat: 25% of calories. Carbs: the rest.
 */
export function suggestGoals(p: Profile, weightKg: number, waterMl = 2500): Goals {
  const maintenance = tdee(p, weightKg)
  const dailyDelta = (p.ratePerWeekKg * KCAL_PER_KG_FAT) / 7
  let calories =
    p.goal === 'lose' ? maintenance - dailyDelta : p.goal === 'gain' ? maintenance + dailyDelta : maintenance
  const floor = p.sex === 'male' ? 1500 : 1200
  calories = Math.max(floor, Math.round(calories / 10) * 10)

  const protein = Math.round(weightKg * (p.goal === 'lose' ? 2.0 : 1.8))
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { calories, protein, carbs, fat, waterMl }
}

/** Calories implied by macros (4/4/9). Useful for validating quick-add input. */
export function caloriesFromMacros(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): number {
  return Math.round(n.protein * 4 + n.carbs * 4 + n.fat * 9)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
