import type { Nutrients } from './types'

/**
 * Open Food Facts client (free, open database — no API key or paywall).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const BASE = 'https://world.openfoodfacts.org'
const TIMEOUT_MS = 12000
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity'

export interface FoodProduct {
  code: string
  name: string
  brand?: string
  per100g: Nutrients
  /** Nutrients for one labelled serving, when the product declares one. */
  perServing?: Nutrients
  servingSize?: string
  servingGrams?: number
}

type Nutriments = Record<string, number | string | undefined>
interface OffProduct {
  code?: string
  product_name?: string
  brands?: string | string[]
  nutriments?: Nutriments
  serving_size?: string
  serving_quantity?: number | string
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

function readNutrients(n: Nutriments, suffix: '_100g' | '_serving'): Nutrients | undefined {
  let kcal = num(n[`energy-kcal${suffix}`])
  if (kcal === undefined) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`])
    if (kj !== undefined) kcal = kj / 4.184
  }
  if (kcal === undefined) return undefined
  return {
    calories: Math.round(kcal),
    protein: round1(num(n[`proteins${suffix}`]) ?? 0),
    carbs: round1(num(n[`carbohydrates${suffix}`]) ?? 0),
    fat: round1(num(n[`fat${suffix}`]) ?? 0),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function parseProduct(p: OffProduct): FoodProduct | null {
  const name = p.product_name?.trim()
  const per100g = p.nutriments ? readNutrients(p.nutriments, '_100g') : undefined
  if (!name || !per100g || !p.code) return null
  const servingGrams = num(p.serving_quantity)
  let perServing = p.nutriments ? readNutrients(p.nutriments, '_serving') : undefined
  if (!perServing && servingGrams) {
    const f = servingGrams / 100
    perServing = {
      calories: Math.round(per100g.calories * f),
      protein: round1(per100g.protein * f),
      carbs: round1(per100g.carbs * f),
      fat: round1(per100g.fat * f),
    }
  }
  return {
    code: p.code,
    name,
    brand: (Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0])?.trim() || undefined,
    per100g,
    perServing,
    servingSize: p.serving_size || undefined,
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
  }
}

/** Combines the caller's abort signal with a timeout. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  // AbortSignal.timeout/any need Safari 16/17.4+; fall back gracefully on older devices.
  if (typeof AbortSignal.timeout !== 'function') return signal ?? new AbortController().signal
  const t = AbortSignal.timeout(TIMEOUT_MS)
  if (!signal) return t
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, t]) : signal
}

function dedupe(products: FoodProduct[]): FoodProduct[] {
  const seen = new Set<string>()
  return products.filter((p) => (seen.has(p.code) ? false : (seen.add(p.code), true)))
}

const parseList = (list: OffProduct[] | undefined) => dedupe((list ?? []).map(parseProduct).filter((p): p is FoodProduct => p !== null))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The legacy endpoint is the only Open Food Facts search that allows browser (CORS) calls.
 * It rate-limits with 503s that carry no CORS headers (so they look like network errors);
 * one delayed retry usually gets through.
 */
async function searchLegacy(query: string, signal?: AbortSignal): Promise<FoodProduct[]> {
  const url = `${BASE}/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}&search_terms=${encodeURIComponent(query)}`
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: withTimeout(signal) })
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      return parseList(((await res.json()) as { products?: OffProduct[] }).products)
    } catch (err) {
      if (signal?.aborted || attempt >= 1) throw err
      await sleep(1500)
    }
  }
}

/** Searches packaged foods on Open Food Facts. */
export function searchFoods(query: string, signal?: AbortSignal): Promise<FoodProduct[]> {
  return searchLegacy(query, signal)
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<FoodProduct | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal: withTimeout(signal) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const body = (await res.json()) as { status?: number; product?: OffProduct }
  if (body.status !== 1 || !body.product) return null
  return parseProduct({ ...body.product, code: body.product.code ?? code })
}
