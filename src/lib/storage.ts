import { uid } from './uid'
import type { AppData, DateKey, ExerciseEntry, FoodEntry, MealSlot, Nutrients, SavedMeal, WeighIn } from './types'
import { DATA_VERSION, DEFAULT_SETTINGS, MEAL_SLOTS, emptyData } from './types'

/**
 * Storage adapter. The web app uses localStorage; a React Native port can
 * swap in AsyncStorage / MMKV by implementing this interface.
 */
export interface StorageAdapter {
  load(): AppData | null
  /** Throws if the data could not be written (e.g. storage full). */
  save(data: AppData): void
}

export const STORAGE_KEY = 'calorie-tracker:v1'

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? parseData(raw) : null
    } catch (err) {
      console.error('Failed to load data', err)
      return null
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  },
}

// ---------- Parsing, validation and migration ----------

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is DateKey => typeof v === 'string' && DATE_RE.test(v)
const finite = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function nutrients(v: unknown): Nutrients {
  const o = isObj(v) ? v : {}
  return { calories: finite(o.calories), protein: finite(o.protein), carbs: finite(o.carbs), fat: finite(o.fat) }
}

function entry(v: unknown): FoodEntry | null {
  if (!isObj(v) || !isDate(v.date) || !MEAL_SLOTS.includes(v.slot as MealSlot)) return null
  const servings = finite(v.servings, 1)
  return {
    ...(v as unknown as FoodEntry),
    id: str(v.id) ?? uid(),
    name: str(v.name)?.trim() || 'Food',
    nutrients: nutrients(v.nutrients),
    servings: servings > 0 ? servings : 1,
    source: (['quick', 'saved', 'food'] as const).includes(v.source as 'quick') ? (v.source as FoodEntry['source']) : 'quick',
    createdAt: finite(v.createdAt, 0),
  }
}

function savedMeal(v: unknown): SavedMeal | null {
  if (!isObj(v) || !str(v.name)) return null
  return {
    ...(v as unknown as SavedMeal),
    id: str(v.id) ?? uid(),
    nutrients: nutrients(v.nutrients),
    useCount: finite(v.useCount),
    createdAt: finite(v.createdAt),
  }
}

function weighIn(v: unknown): WeighIn | null {
  if (!isObj(v) || !isDate(v.date)) return null
  const kg = finite(v.weightKg)
  return kg > 0 ? { ...(v as unknown as WeighIn), weightKg: kg } : null
}

function exercise(v: unknown): ExerciseEntry | null {
  if (!isObj(v) || !isDate(v.date)) return null
  return { ...(v as unknown as ExerciseEntry), id: str(v.id) ?? uid(), name: str(v.name) || 'Exercise', calories: finite(v.calories) }
}

const list = <T>(v: unknown, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null) : []

/** Upgrades older saved data / backups to the current shape. */
function migrate(parsed: Raw): Raw {
  let d = parsed
  if (d.version === 1) {
    // v2 added `meta`. Anyone with v1 data has already been using the app.
    d = { ...d, version: 2, meta: { onboarded: true } }
  }
  return d
}

/** Parses, migrates and normalises data from storage or a backup file. Throws on invalid input. */
export function parseData(raw: string): AppData {
  let parsed: unknown = JSON.parse(raw)
  if (!isObj(parsed) || typeof parsed.version !== 'number' || parsed.version < 1) {
    throw new Error('Unrecognised backup format')
  }
  if (parsed.version > DATA_VERSION) throw new Error('This backup is from a newer version of the app')
  parsed = migrate(parsed)
  const p = parsed as Raw
  const base = emptyData()
  const settings = isObj(p.settings) ? p.settings : {}
  const meta = isObj(p.meta) ? p.meta : {}
  const water: Record<DateKey, number> = {}
  if (isObj(p.water)) for (const [k, v] of Object.entries(p.water)) if (isDate(k) && finite(v) > 0) water[k] = finite(v)
  // One weigh-in per date: keep the last one if a hand-edited backup has duplicates.
  const weighIns = [...new Map(list(p.weighIns, weighIn).map((w) => [w.date, w])).values()]
  return {
    ...base,
    entries: list(p.entries, entry),
    savedMeals: list(p.savedMeals, savedMeal),
    weighIns,
    exercise: list(p.exercise, exercise),
    water,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(settings as Partial<AppData['settings']>),
      goals: { ...DEFAULT_SETTINGS.goals, ...(isObj(settings.goals) ? (settings.goals as Partial<AppData['settings']['goals']>) : {}) },
    },
    meta: {
      onboarded: meta.onboarded === true,
      lastBackupAt: typeof meta.lastBackupAt === 'number' ? meta.lastBackupAt : undefined,
      backupReminderDismissedAt: typeof meta.backupReminderDismissedAt === 'number' ? meta.backupReminderDismissedAt : undefined,
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
