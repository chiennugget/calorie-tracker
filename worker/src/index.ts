/**
 * Calorie Tracker AI worker (Cloudflare Workers).
 *
 * POST /estimate  { image: <base64 JPEG>, note?: string }  -> AiEstimate
 * GET  /health                                             -> { ok, model }
 * GET  /search?q=chicken                                   -> { hits } (Open Food Facts proxy)
 *
 * Holds the Gemini API key as a secret so it never ships in the web app.
 * Requests must carry `X-App-Token` matching the APP_TOKEN secret and come
 * from an allowed origin.
 */
import { OIL_LABELS, PORTION_LABELS, SG_DISHES, SG_DISH_BY_ID } from '../../src/lib/sgFoods'

export interface Env {
  GEMINI_API_KEY: string
  APP_TOKEN: string
  /** Comma-separated list, e.g. "https://you.github.io,http://localhost:5173" */
  ALLOWED_ORIGINS?: string
  /** Defaults to the rolling "latest Flash" alias so Google model retirements don't break it. */
  GEMINI_MODEL?: string
}

export interface AiItem {
  name: string
  matchId: string
  portion: 'small' | 'regular' | 'large' | 'upsize'
  oil: 'less' | 'normal' | 'extra'
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: 'low' | 'medium' | 'high'
  notes: string
}

export interface AiEstimate {
  items: AiItem[]
  summary: string
  model: string
}

const DEFAULT_MODEL = 'gemini-flash-latest'
const MAX_IMAGE_BASE64 = 6_000_000 // ~4.5 MB raw; the app sends ~150 KB

const dishList = SG_DISHES.map((d) => `${d.id}: ${d.name} [${d.serving}, ~${d.n.calories} kcal]`).join('\n')

export const SYSTEM_PROMPT = `You are a nutrition estimator for a calorie-tracking app used in Singapore.
Look at the food photo and estimate calories and macros for each separate item (e.g. a plate of noodles AND a drink are two items).

Singapore context:
- Assume food is from a Singapore hawker centre, kopitiam, food court or zi char stall unless it clearly isn't.
- Hawker cooking uses a lot of oil, lard and coconut milk; fried noodles and rice are much oilier than home cooking. Look for visible oil sheen, pooled oil, crispy lard bits, fried items and coconut gravy when judging the oil level.
- "regular" portion = a standard single hawker plate/bowl. Use "large"/"upsize" for visibly big or upsized portions, "small" for small ones.
- Kopitiam drinks: kopi/teh default to condensed milk and sugar.

Known dishes (id: name [serving, typical kcal]). If an item is clearly one of these, set matchId to its id; otherwise set matchId to "".
${dishList}

Rules:
- Always give your own calories/protein/carbs/fat estimate for the WHOLE item as you see it (including portion and oil level).
- portion: small | regular | large | upsize. oil: less | normal | extra (use "normal" for non-oily items like drinks).
- confidence reflects how sure you are of the dish identity AND amount.
- notes: one short sentence on key assumptions (e.g. "Assumed fried egg and 2 chicken wings").
- If the photo has no food, return an empty items array and explain in summary.
- Numbers in kcal and grams, no ranges.`

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          matchId: { type: 'STRING' },
          portion: { type: 'STRING', enum: Object.keys(PORTION_LABELS) },
          oil: { type: 'STRING', enum: Object.keys(OIL_LABELS) },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          notes: { type: 'STRING' },
        },
        required: ['name', 'matchId', 'portion', 'oil', 'calories', 'protein', 'carbs', 'fat', 'confidence', 'notes'],
        propertyOrdering: ['name', 'matchId', 'portion', 'oil', 'calories', 'protein', 'carbs', 'fat', 'confidence', 'notes'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['items', 'summary'],
  propertyOrdering: ['items', 'summary'],
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const ok = origin && (allowed.length === 0 || allowed.includes(origin))
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
}

const clampNum = (v: unknown, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0
}
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback

/** Validates and normalises the model's JSON so the app never gets junk. */
export function sanitiseEstimate(raw: unknown, model: string): AiEstimate {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as { items?: unknown[]; summary?: unknown }
  const items = (Array.isArray(obj.items) ? obj.items : []).slice(0, 8).map((it): AiItem => {
    const i = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
    const matchId = typeof i.matchId === 'string' && SG_DISH_BY_ID[i.matchId] ? i.matchId : ''
    return {
      name: String(i.name ?? 'Food').slice(0, 80) || 'Food',
      matchId,
      portion: pick(i.portion, ['small', 'regular', 'large', 'upsize'] as const, 'regular'),
      oil: pick(i.oil, ['less', 'normal', 'extra'] as const, 'normal'),
      calories: Math.round(clampNum(i.calories, 5000)),
      protein: clampNum(i.protein, 500),
      carbs: clampNum(i.carbs, 1000),
      fat: clampNum(i.fat, 500),
      confidence: pick(i.confidence, ['low', 'medium', 'high'] as const, 'low'),
      notes: String(i.notes ?? '').slice(0, 200),
    }
  })
  return { items, summary: String(obj.summary ?? '').slice(0, 300), model }
}

export async function estimate(image: string, note: string, env: Env, fetchImpl: typeof fetch = fetch): Promise<AiEstimate> {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL
  const userText = note
    ? `Estimate the food in this photo. Extra info from the user: ${note.slice(0, 300)}`
    : 'Estimate the food in this photo.'
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: userText }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new UpstreamError(res.status, detail.slice(0, 500))
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new UpstreamError(502, body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? 'Empty response')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new UpstreamError(502, 'Model returned invalid JSON')
  }
  return sanitiseEstimate(parsed, model)
}

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity'

/**
 * Proxies Open Food Facts' newer search service, which blocks browser (CORS) calls
 * from other sites. Results are cached at Cloudflare's edge for a day.
 */
export async function searchFoods(request: Request, cors: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (!q) return json({ hits: [] }, 200, cors)
  const upstream = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=30&fields=${OFF_FIELDS}`
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : undefined
  const cacheKey = new Request(upstream)
  let res = cache ? await cache.match(cacheKey) : undefined
  if (!res) {
    res = await fetchImpl(upstream, { headers: { 'User-Agent': 'CalorieTracker/1.0 (personal app)' } })
    if (!res.ok) return json({ error: `Food search failed (${res.status})` }, 502, cors)
    const body = (await res.json()) as { hits?: unknown[] }
    res = new Response(JSON.stringify({ hits: body.hits ?? [] }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    })
    await cache?.put(cacheKey, res.clone())
  }
  return new Response(res.body, { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export class UpstreamError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, cors)
    if (!env.APP_TOKEN || request.headers.get('X-App-Token') !== env.APP_TOKEN) {
      return json({ error: 'Wrong or missing access code' }, 401, cors)
    }
    if (!env.GEMINI_API_KEY) return json({ error: 'Server is missing GEMINI_API_KEY' }, 500, cors)

    const { pathname } = new URL(request.url)
    if (pathname === '/health') return json({ ok: true, model: env.GEMINI_MODEL || DEFAULT_MODEL }, 200, cors)
    if (pathname === '/search' && request.method === 'GET') return searchFoods(request, cors)
    if (pathname !== '/estimate' || request.method !== 'POST') return json({ error: 'Not found' }, 404, cors)

    let payload: { image?: unknown; note?: unknown }
    try {
      payload = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, cors)
    }
    const image = typeof payload.image === 'string' ? payload.image.replace(/^data:image\/\w+;base64,/, '') : ''
    if (!image) return json({ error: 'Missing image' }, 400, cors)
    if (image.length > MAX_IMAGE_BASE64) return json({ error: 'Image too large' }, 413, cors)
    const note = typeof payload.note === 'string' ? payload.note : ''

    try {
      return json(await estimate(image, note, env), 200, cors)
    } catch (err) {
      if (err instanceof UpstreamError) {
        const message =
          err.status === 429
            ? 'Free AI quota used up for now — try again later.'
            : err.status === 400 || err.status === 403
              ? `AI request rejected (${err.status}). Check the Gemini API key / model.`
              : `AI service error (${err.status}).`
        return json({ error: message, detail: err.message }, err.status === 429 ? 429 : 502, cors)
      }
      return json({ error: 'Unexpected error' }, 500, cors)
    }
  },
}
