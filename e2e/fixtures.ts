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

// ---------- Fake Supabase (cloud backup) ----------

/** Must match VITE_SUPABASE_URL in playwright.config.ts. */
export const SUPABASE_URL = 'https://e2e-project.supabase.co'
export const OTP_CODE = '123456'
const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'me@example.com' }

export interface CloudRow {
  day: string
  data: Seed
  updated_at: string
  entry_count: number
  weigh_in_count: number
  data_version: number
}

export function cloudRow(dayKey: string, data: Seed): CloudRow {
  return {
    day: dayKey,
    data,
    updated_at: new Date().toISOString(),
    entry_count: (data.entries as unknown[]).length,
    weigh_in_count: (data.weighIns as unknown[]).length,
    data_version: data.version as number,
  }
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, exp, role: 'authenticated', aud: 'authenticated' })}.sig`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh-token',
    user: { ...USER, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

/** In-memory Supabase: email-code auth and the `backups` table. Returns the live state for assertions. */
export async function mockSupabase(page: Page, rows: CloudRow[] = []) {
  const state = { rows: [...rows], uploads: 0, codesSent: [] as string[], fail: false }
  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: CORS, json: body })
    if (state.fail) return route.abort('internetdisconnected')

    if (url.pathname === '/auth/v1/otp') {
      state.codesSent.push(req.postDataJSON().email)
      return json(200, {})
    }
    if (url.pathname === '/auth/v1/verify') {
      const body = req.postDataJSON()
      if (body.token !== OTP_CODE) return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' })
      return json(200, session())
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })
    if (url.pathname === '/auth/v1/user') return json(200, session().user)

    if (url.pathname === '/rest/v1/backups') {
      const dayFilter = url.searchParams.get('day')
      if (method === 'GET') {
        if (dayFilter?.startsWith('eq.')) {
          const row = state.rows.find((r) => r.day === dayFilter.slice(3))
          return row ? json(200, { data: row.data }) : json(406, { code: 'PGRST116', message: 'No rows' })
        }
        const list = [...state.rows].sort((a, b) => b.day.localeCompare(a.day)).map(({ data: _d, ...rest }) => rest)
        return json(200, list)
      }
      if (method === 'POST') {
        const body = req.postDataJSON()
        for (const r of Array.isArray(body) ? body : [body]) {
          state.uploads++
          const row: CloudRow = { day: r.day, data: r.data, updated_at: r.updated_at, entry_count: r.entry_count, weigh_in_count: r.weigh_in_count, data_version: r.data_version }
          state.rows = [...state.rows.filter((x) => x.day !== r.day), row]
        }
        return route.fulfill({ status: 201, headers: CORS, body: '' })
      }
      if (method === 'DELETE') {
        const days = dayFilter?.match(/^in\.\((.*)\)$/)?.[1].split(',').map((d) => d.replaceAll('"', '')) ?? []
        state.rows = state.rows.filter((r) => !days.includes(r.day))
        return route.fulfill({ status: 204, headers: CORS })
      }
    }
    return json(404, { message: `Unmocked ${method} ${url.pathname}` })
  })
  // Upload quickly instead of waiting ~20 s after each change.
  await page.addInitScript(() => {
    ;(globalThis as { __cloudDebounceMs?: number }).__cloudDebounceMs = 300
  })
  return state
}

/** Starts the app already signed in to cloud backup (as if signed in on an earlier visit). */
export async function signedIn(page: Page) {
  const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  await page.addInitScript(
    ([k, json]) => {
      if (sessionStorage.getItem('__cloudSeeded')) return
      sessionStorage.setItem('__cloudSeeded', '1')
      localStorage.setItem(k, json)
    },
    [key, JSON.stringify(session())] as const,
  )
}

// Never hit the real Open Food Facts API (or Supabase) from tests; individual tests can override this.
test.beforeEach(async ({ page }) => {
  await page.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ status: 200, json: { products: [] } }))
  await page.route(`${SUPABASE_URL}/**`, (r) => r.abort('internetdisconnected'))
})

export { expect }
