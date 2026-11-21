import { test as base, expect, type Page } from '@playwright/test'

export const STORAGE_KEY = 'calorie-tracker:v1'

const pad = (n: number) => String(n).padStart(2, '0')
/** Local YYYY-MM-DD, `offset` days from today (matches lib/date.ts). */
export function day(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Seed = Record<string, unknown>

export function seedData(over: Seed = {}): Seed {
  return {
    version: 2,
    entries: [],
    savedMeals: [],
    weighIns: [],
    exercise: [],
    water: {},
    settings: { weightUnit: 'kg', waterUnit: 'ml', goals: { calories: 2000, protein: 150, carbs: 200, fat: 67, waterMl: 2500 } },
    meta: { onboarded: true, lastBackupAt: Date.now() },
    ...over,
  }
}

let n = 0
export function entry(date: string, slot: string, name: string, calories: number, extra: Seed = {}): Seed {
  return {
    id: `e${++n}`,
    date,
    slot,
    name,
    nutrients: { calories, protein: 10, carbs: 20, fat: 5 },
    servings: 1,
    source: 'quick',
    createdAt: Date.now() - 1e6 + n,
    ...extra,
  }
}

/** Writes app data to localStorage before the app boots. Pass null for a fresh install. */
export async function seed(page: Page, data: Seed | null) {
  await page.addInitScript(
    ([key, json]) => {
      // Only seed once per test, so reloads keep what the app saved.
      if (sessionStorage.getItem('__seeded')) return
      sessionStorage.setItem('__seeded', '1')
      localStorage.clear()
      if (json) localStorage.setItem(key, json)
    },
    [STORAGE_KEY, data ? JSON.stringify(data) : null] as const,
  )
}

export async function readData(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)
}

export const test = base

// Never hit the real Open Food Facts API from tests; individual tests can override this.
test.beforeEach(async ({ page }) => {
  await page.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ status: 200, json: { products: [] } }))
})

export { expect }
