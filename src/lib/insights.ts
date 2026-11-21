// Derived insights: weekly budget, real-maintenance estimate, goal projection,
// and the "what do I usually eat" lists that make logging faster.
// Pure TypeScript, no DOM, so it ports to React Native unchanged.

import { addDays, fromDateKey, lastNDays } from './date'
import { daySummary, sumEntries, trendWeights } from './nutrition'
import type { AppData, DateKey, FoodEntry, MealSlot, Profile } from './types'

const KCAL_PER_KG = 7700
const DAY_MS = 864e5

const daysBetween = (a: DateKey, b: DateKey) => Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / DAY_MS)

/** Monday-start week containing `d`. */
export function weekOf(d: DateKey): DateKey[] {
  const day = (fromDateKey(d).getDay() + 6) % 7
  const start = addDays(d, -day)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export interface WeekBudget {
  /** Calorie budget for the days that count (logged past days + today + rest of week). */
  budget: number
  eaten: number
  remaining: number
  /** Days from `date` to Sunday, inclusive. */
  daysLeft: number
  /** Suggested average for each remaining day (today included) to land on budget. */
  perDayLeft: number
  /** Past days this week with nothing logged; they're left out of the budget. */
  skippedDays: number
}

/**
 * A weekly view of the daily goal, so one big hawker dinner can be balanced
 * over the rest of the week. Past days with no entries are treated as "not
 * tracked" rather than "ate nothing", so forgetting to log doesn't inflate
 * the budget.
 */
export function weekBudget(data: AppData, date: DateKey): WeekBudget {
  const goal = data.settings.goals.calories
  const week = weekOf(date)
  let budget = 0
  let eaten = 0
  let skippedDays = 0
  let eatenBeforeToday = 0
  for (const d of week) {
    const s = daySummary(data, d)
    if (d < date && !s.logged) {
      skippedDays++
      continue
    }
    budget += goal
    eaten += s.food.calories
    if (d < date) eatenBeforeToday += s.food.calories
  }
  const daysLeft = week.filter((d) => d >= date).length
  const budgetLeft = budget - eatenBeforeToday
  return {
    budget,
    eaten,
    remaining: budget - eaten,
    daysLeft,
    perDayLeft: daysLeft ? Math.max(0, Math.round(budgetLeft / daysLeft)) : 0,
    skippedDays,
  }
}

/** Least-squares slope (kg/day) of the trend weight over the given points. */
function slopePerDay(points: { date: DateKey; trend: number }[]): number {
  const x0 = points[0].date
  const xs = points.map((p) => daysBetween(x0, p.date))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = points.reduce((a, p) => a + p.trend, 0) / points.length
  let num = 0
  let den = 0
  points.forEach((p, i) => {
    num += (xs[i] - mx) * (p.trend - my)
    den += (xs[i] - mx) ** 2
  })
  return den ? num / den : 0
}

export interface TdeeEstimate {
  /** Estimated real maintenance calories per day. */
  tdee: number
  avgIntake: number
  /** Trend weight change, kg per week (negative = losing). */
  kgPerWeek: number
  loggedDays: number
  spanDays: number
}

/**
 * Adaptive maintenance estimate (the "MacroFactor" idea): if you ate X kcal/day
 * on average and your trend weight moved Y kg/week, maintenance ≈ X − Y × 7700 / 7.
 * Needs at least 14 days between weigh-ins and 10 logged days, otherwise the
 * noise swamps the signal.
 */
export function estimateTdee(data: AppData, end: DateKey, windowDays = 28): TdeeEstimate | null {
  const start = addDays(end, -(windowDays - 1))
  const trend = trendWeights(data.weighIns).filter((p) => p.date >= start && p.date <= end)
  if (trend.length < 3) return null
  const spanDays = daysBetween(trend[0].date, trend.at(-1)!.date)
  if (spanDays < 14) return null
  const logged = lastNDays(end, windowDays)
    .map((d) => daySummary(data, d))
    .filter((s) => s.logged)
  if (logged.length < 10) return null
  const avgIntake = logged.reduce((a, s) => a + s.food.calories, 0) / logged.length
  const kgPerDay = slopePerDay(trend)
  return {
    tdee: Math.round((avgIntake - kgPerDay * KCAL_PER_KG) / 10) * 10,
    avgIntake: Math.round(avgIntake),
    kgPerWeek: kgPerDay * 7,
    loggedDays: logged.length,
    spanDays,
  }
}

/** Daily calorie goal that hits the profile's weekly rate, given a measured maintenance. */
export function adaptiveCalorieGoal(tdee: number, profile: Pick<Profile, 'goal' | 'ratePerWeekKg' | 'sex'>): number {
  const delta = (profile.ratePerWeekKg * KCAL_PER_KG) / 7
  const raw = profile.goal === 'lose' ? tdee - delta : profile.goal === 'gain' ? tdee + delta : tdee
  const floor = profile.sex === 'male' ? 1500 : 1200
  return Math.max(floor, Math.round(raw / 10) * 10)
}

export interface GoalProjection {
  /** Projected date the trend weight reaches the goal. */
  date: DateKey
  weeks: number
  kgPerWeek: number
  remainingKg: number
}

/**
 * When will the trend weight reach the goal at the current pace (last 4 weeks)?
 * Returns null without a goal, without enough data, or when the trend is
 * heading the wrong way or is basically flat.
 */
export function projectGoalDate(data: AppData, end: DateKey): GoalProjection | null {
  const goalKg = data.settings.profile?.goalWeightKg
  if (!goalKg) return null
  const series = trendWeights(data.weighIns).filter((p) => p.date <= end)
  const recent = series.filter((p) => p.date >= addDays(end, -27))
  if (recent.length < 3 || daysBetween(recent[0].date, recent.at(-1)!.date) < 10) return null
  const current = series.at(-1)!.trend
  const remainingKg = goalKg - current
  if (Math.abs(remainingKg) < 0.1) return null
  const kgPerDay = slopePerDay(recent)
  // Needs to be heading toward the goal at >= 50 g/week to be meaningful.
  if (Math.sign(kgPerDay) !== Math.sign(remainingKg) || Math.abs(kgPerDay * 7) < 0.05) return null
  const days = Math.ceil(remainingKg / kgPerDay)
  if (days > 3 * 365) return null
  return { date: addDays(series.at(-1)!.date, days), weeks: days / 7, kgPerWeek: kgPerDay * 7, remainingKg }
}

// ---------- Faster logging ----------

export interface FoodSuggestion {
  entry: FoodEntry
  /** Times this food was logged in the given meal slot. */
  slotCount: number
  totalCount: number
  lastUsed: number
}

const foodKey = (e: FoodEntry) => `${e.name.trim().toLowerCase()}|${Math.round(e.nutrients.calories)}`

/** Distinct foods you've logged, most recent first, with how often each was logged per slot. */
export function recentFoods(data: AppData, slot: MealSlot, limit = 40): FoodSuggestion[] {
  const map = new Map<string, FoodSuggestion>()
  for (const e of [...data.entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const k = foodKey(e)
    const s = map.get(k)
    if (s) {
      s.totalCount++
      if (e.slot === slot) s.slotCount++
    } else map.set(k, { entry: e, slotCount: e.slot === slot ? 1 : 0, totalCount: 1, lastUsed: e.createdAt })
  }
  return [...map.values()].slice(0, limit)
}

/** Foods you've had at least twice for this meal, most frequent first: "your usual". */
export function usualFoods(data: AppData, slot: MealSlot, limit = 5): FoodSuggestion[] {
  return recentFoods(data, slot, Infinity)
    .filter((s) => s.slotCount >= 2)
    .sort((a, b) => b.slotCount - a.slotCount || b.lastUsed - a.lastUsed)
    .slice(0, limit)
}

export interface PastMeal {
  date: DateKey
  slot: MealSlot
  entries: FoodEntry[]
  calories: number
}

/** Recent whole meals (2+ items) you could log again in one tap, newest first, deduped by contents. */
export function recentMeals(data: AppData, before: DateKey, days = 21, limit = 8): PastMeal[] {
  const from = addDays(before, -days)
  const groups = new Map<string, FoodEntry[]>()
  for (const e of data.entries) {
    if (e.date < from || e.date > before) continue
    const k = `${e.date}|${e.slot}`
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  const seen = new Set<string>()
  const out: PastMeal[] = []
  for (const [k, entries] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (entries.length < 2) continue
    const sig = entries.map(foodKey).sort().join('+')
    if (seen.has(sig)) continue
    seen.add(sig)
    const [date, slot] = k.split('|') as [DateKey, MealSlot]
    out.push({ date, slot, entries: [...entries].sort((a, b) => a.createdAt - b.createdAt), calories: sumEntries(entries).calories })
    if (out.length >= limit) break
  }
  return out
}

// ---------- Backup reminder ----------

export const BACKUP_REMIND_AFTER_DAYS = 14

/** Show a backup nudge once there's enough data to lose and the last backup (or dismissal) is stale. */
export function shouldRemindBackup(data: AppData, now: number): boolean {
  if (data.entries.length + data.weighIns.length < 15) return false
  const last = Math.max(data.meta.lastBackupAt ?? 0, data.meta.backupReminderDismissedAt ?? 0)
  if (!last) {
    // First reminder: wait until the user has been at it for about a week.
    const first = Math.min(...data.entries.map((e) => e.createdAt).filter((t) => t > 0), now)
    return now - first >= 7 * DAY_MS
  }
  return now - last >= BACKUP_REMIND_AFTER_DAYS * DAY_MS
}
