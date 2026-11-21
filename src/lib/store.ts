import type {
  AppData,
  DateKey,
  ExerciseEntry,
  FoodEntry,
  MealSlot,
  Nutrients,
  SavedMeal,
  Meta,
  Settings,
  WeighIn,
} from './types'
import { emptyData } from './types'
import type { StorageAdapter } from './storage'
import { uid } from './uid'

type Listener = () => void

/**
 * Tiny framework-agnostic store. All mutations go through here so the same
 * actions can drive a web UI, a React Native UI, or tests.
 */
export class Store {
  private data: AppData
  private listeners = new Set<Listener>()
  private storage?: StorageAdapter
  private onSaveError?: (err: unknown) => void
  /** True while the latest change has not been written to storage. */
  saveFailed = false

  constructor(storage?: StorageAdapter, initial?: AppData) {
    this.storage = storage
    this.data = initial ?? storage?.load() ?? emptyData()
  }

  /** Called when a change can't be persisted (e.g. storage full or blocked). */
  setSaveErrorHandler(fn: (err: unknown) => void) {
    this.onSaveError = fn
  }

  /** Re-reads storage, e.g. after another tab changed it. */
  reload() {
    const fresh = this.storage?.load()
    if (!fresh) return
    this.data = fresh
    this.listeners.forEach((l) => l())
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
    try {
      this.storage?.save(this.data)
      this.saveFailed = false
    } catch (err) {
      this.saveFailed = true
      this.onSaveError?.(err)
    }
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

  deleteEntries(ids: string[]) {
    const drop = new Set(ids)
    this.set((d) => ({ ...d, entries: d.entries.filter((e) => !drop.has(e.id)) }))
  }

  /** Copies all entries from one day/meal to another (MyFitnessPal "copy meal"). Returns the new entries. */
  copyEntries(fromDate: DateKey, toDate: DateKey, slot?: MealSlot, toSlot?: MealSlot): FoodEntry[] {
    const src = this.data.entries
      .filter((e) => e.date === fromDate && (!slot || e.slot === slot))
      .sort((a, b) => a.createdAt - b.createdAt)
    if (!src.length) return []
    const now = Date.now()
    const copies = src.map((e, i) => ({
      ...e,
      id: uid(),
      date: toDate,
      slot: toSlot ?? e.slot,
      createdAt: now + i,
    }))
    this.set((d) => ({ ...d, entries: [...d.entries, ...copies] }))
    return copies
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

  updateMeta(patch: Partial<Meta>) {
    this.set((d) => ({ ...d, meta: { ...d.meta, ...patch } }))
  }

  /** Restores a backup. Restoring counts as being onboarded and as a fresh backup. */
  replaceAll(data: AppData) {
    this.set(() => ({ ...data, meta: { ...data.meta, onboarded: true, lastBackupAt: data.meta.lastBackupAt ?? Date.now() } }))
  }

  reset() {
    this.set(() => emptyData())
  }
}
