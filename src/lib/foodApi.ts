import type { Nutrients } from './types'

/**
 * Open Food Facts client (free, open database — no API key or paywall).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const BASE = 'https://world.openfoodfacts.org'
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
  brands?: string
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
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100g,
    perServing,
    servingSize: p.serving_size || undefined,
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
  }
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodProduct[]> {
  const url =
    `${BASE}/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25` +
    `&fields=${FIELDS}&search_terms=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const body = (await res.json()) as { products?: OffProduct[] }
  return (body.products ?? []).map(parseProduct).filter((p): p is FoodProduct => p !== null)
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<FoodProduct | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const body = (await res.json()) as { status?: number; product?: OffProduct }
  if (body.status !== 1 || !body.product) return null
  return parseProduct({ ...body.product, code: body.product.code ?? code })
}
