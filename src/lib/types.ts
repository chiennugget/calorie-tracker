// Core data model. Pure TypeScript with no DOM/React dependencies so it can be
// shared with a future React Native app.

export interface Nutrients {
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
}

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

/** ISO calendar date, e.g. "2026-11-21" (local time). */
export type DateKey = string

export type EntrySource = 'quick' | 'saved' | 'food'

export interface FoodEntry {
  id: string
  date: DateKey
  slot: MealSlot
  name: string
  /** Nutrients for ONE serving. Totals = nutrients * servings. */
  nutrients: Nutrients
  servings: number
  servingLabel?: string
  source: EntrySource
  savedMealId?: string
  barcode?: string
  createdAt: number
}

export interface SavedMeal {
  id: string
  name: string
  nutrients: Nutrients
  servingLabel?: string
  barcode?: string
  useCount: number
  lastUsed?: number
  createdAt: number
}

export interface WeighIn {
  date: DateKey
  weightKg: number
  note?: string
}

export interface ExerciseEntry {
  id: string
  date: DateKey
  name: string
  calories: number
  minutes?: number
  createdAt: number
}

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type WeightGoal = 'lose' | 'maintain' | 'gain'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  activity: ActivityLevel
  goal: WeightGoal
  /** kg per week, positive number; direction comes from `goal`. */
  ratePerWeekKg: number
  goalWeightKg?: number
}

export interface Goals extends Nutrients {
  waterMl: number
}

export interface Settings {
  weightUnit: 'kg' | 'lb'
  waterUnit: 'ml' | 'oz'
  goals: Goals
  profile?: Profile
  /** MyFitnessPal-style: exercise calories increase your remaining budget. */
  addExerciseToBudget: boolean
}

export interface AppData {
  version: 1
  entries: FoodEntry[]
  savedMeals: SavedMeal[]
  weighIns: WeighIn[]
  exercise: ExerciseEntry[]
  /** ml of water per day */
  water: Record<DateKey, number>
  settings: Settings
}

export const ZERO: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 }

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  waterUnit: 'ml',
  goals: { calories: 2000, protein: 150, carbs: 200, fat: 67, waterMl: 2500 },
  addExerciseToBudget: true,
}

export function emptyData(): AppData {
  return {
    version: 1,
    entries: [],
    savedMeals: [],
    weighIns: [],
    exercise: [],
    water: {},
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}
