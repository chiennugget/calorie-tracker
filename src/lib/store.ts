import type {
  AppData,
  DateKey,
  ExerciseEntry,
  FoodEntry,
  MealSlot,
  Nutrients,
  SavedMeal,
  Settings,
  WeighIn,
} from './types'
import { emptyData } from './types'
import type { StorageAdapter } from './storage'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

type Listener = () => void

/**
 * Tiny framework-agnostic store. All mutations go through here so the same
 * actions can drive a web UI, a React Native UI, or tests.
 */
export class Store {
  private data: AppData
  private listeners = new Set<Listener>()
  private storage?: StorageAdapter

  constructor(storage?: StorageAdapter, initial?: AppData) {
    this.storage = storage
    this.data = initial ?? storage?.load() ?? emptyData()
  }

  getState = (): AppData => this.data

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private set(updater: (d: AppData) => AppData) {
    this.data = updater(this.data)
    this.storage?.save(this.data)
    this.listeners.forEach((l) => l())
  }

  // ---------- Food diary ----------

  addEntry(entry: Omit<FoodEntry, 'id' | 'createdAt'>): FoodEntry {
    const full: FoodEntry = { ...entry, id: uid(), createdAt: Date.now() }
    this.set((d) => ({
      ...d,
      entries: [...d.entries, full],
      savedMeals: entry.savedMealId
        ? d.savedMeals.map((m) =>
            m.id === entry.savedMealId ? { ...m, useCount: m.useCount + 1, lastUsed: Date.now() } : m,
          )
        : d.savedMeals,
    }))
    return full
  }

  updateEntry(id: string, patch: Partial<Omit<FoodEntry, 'id'>>) {
    this.set((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  }

  deleteEntry(id: string) {
    this.set((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))
  }

  /** Copies all entries from one day/meal to another (MyFitnessPal "copy meal"). */
  copyEntries(fromDate: DateKey, toDate: DateKey, slot?: MealSlot, toSlot?: MealSlot): number {
    const src = this.data.entries.filter((e) => e.date === fromDate && (!slot || e.slot === slot))
    if (!src.length) return 0
    const now = Date.now()
    const copies = src.map((e, i) => ({
      ...e,
      id: uid(),
      date: toDate,
      slot: toSlot ?? e.slot,
      createdAt: now + i,
    }))
    this.set((d) => ({ ...d, entries: [...d.entries, ...copies] }))
    return copies.length
  }

  // ---------- Saved meals ----------

  saveMeal(meal: { name: string; nutrients: Nutrients; servingLabel?: string; barcode?: string }): SavedMeal {
    const full: SavedMeal = { ...meal, id: uid(), useCount: 0, createdAt: Date.now() }
    this.set((d) => ({ ...d, savedMeals: [...d.savedMeals, full] }))
    return full
  }

  updateSavedMeal(id: string, patch: Partial<Omit<SavedMeal, 'id'>>) {
    this.set((d) => ({ ...d, savedMeals: d.savedMeals.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  }

  /** Re-inserts a previously deleted saved meal (used for undo). */
  restoreSavedMeal(meal: SavedMeal) {
    this.set((d) => ({ ...d, savedMeals: [...d.savedMeals.filter((m) => m.id !== meal.id), meal] }))
  }

  deleteSavedMeal(id: string) {
    this.set((d) => ({ ...d, savedMeals: d.savedMeals.filter((m) => m.id !== id) }))
  }

  // ---------- Weight ----------

  /** One weigh-in per day; logging again on the same day replaces it. */
  logWeight(w: WeighIn) {
    this.set((d) => ({ ...d, weighIns: [...d.weighIns.filter((x) => x.date !== w.date), w] }))
  }

  deleteWeight(date: DateKey) {
    this.set((d) => ({ ...d, weighIns: d.weighIns.filter((x) => x.date !== date) }))
  }

  // ---------- Exercise ----------

  addExercise(x: Omit<ExerciseEntry, 'id' | 'createdAt'>) {
    this.set((d) => ({ ...d, exercise: [...d.exercise, { ...x, id: uid(), createdAt: Date.now() }] }))
  }

  deleteExercise(id: string) {
    this.set((d) => ({ ...d, exercise: d.exercise.filter((x) => x.id !== id) }))
  }

  // ---------- Water ----------

  addWater(date: DateKey, ml: number) {
    this.set((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, (d.water[date] ?? 0) + ml) } }))
  }

  setWater(date: DateKey, ml: number) {
    this.set((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, ml) } }))
  }

  // ---------- Settings / data ----------

  updateSettings(patch: Partial<Settings>) {
    this.set((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }

  replaceAll(data: AppData) {
    this.set(() => data)
  }

  reset() {
    this.set(() => emptyData())
  }
}
