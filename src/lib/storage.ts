import type { AppData } from './types'
import { DEFAULT_SETTINGS, emptyData } from './types'

/**
 * Storage adapter. The web app uses localStorage; a React Native port can
 * swap in AsyncStorage / MMKV by implementing this interface.
 */
export interface StorageAdapter {
  load(): AppData | null
  save(data: AppData): void
}

const KEY = 'calorie-tracker:v1'

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? parseData(raw) : null
    } catch {
      return null
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to save data', err)
    }
  },
}

/** Parses and normalises data from storage or a backup file. Throws on invalid input. */
export function parseData(raw: string): AppData {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
    throw new Error('Unrecognised backup format')
  }
  const base = emptyData()
  return {
    ...base,
    ...parsed,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    savedMeals: Array.isArray(parsed.savedMeals) ? parsed.savedMeals : [],
    weighIns: Array.isArray(parsed.weighIns) ? parsed.weighIns : [],
    exercise: Array.isArray(parsed.exercise) ? parsed.exercise : [],
    water: parsed.water && typeof parsed.water === 'object' ? parsed.water : {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...parsed.settings,
      goals: { ...DEFAULT_SETTINGS.goals, ...parsed.settings?.goals },
    },
  }
}

export function serialiseData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

/** CSV export of the food diary (one row per entry, totals already multiplied by servings). */
export function diaryToCsv(data: AppData): string {
  const header = ['date', 'meal', 'name', 'servings', 'calories', 'protein_g', 'carbs_g', 'fat_g']
  const rows = [...data.entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((e) => [
      e.date,
      e.slot,
      `"${e.name.replaceAll('"', '""')}"`,
      e.servings,
      Math.round(e.nutrients.calories * e.servings),
      round(e.nutrients.protein * e.servings),
      round(e.nutrients.carbs * e.servings),
      round(e.nutrients.fat * e.servings),
    ])
  return [header, ...rows].map((r) => r.join(',')).join('\n')
}

export function weighInsToCsv(data: AppData): string {
  const rows = [...data.weighIns]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => [w.date, round(w.weightKg), `"${(w.note ?? '').replaceAll('"', '""')}"`])
  return [['date', 'weight_kg', 'note'], ...rows].map((r) => r.join(',')).join('\n')
}

const round = (n: number) => Math.round(n * 10) / 10
