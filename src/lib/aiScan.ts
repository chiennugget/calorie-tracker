/**
 * Client for the optional AI food-photo worker (see /worker).
 * Config is kept in its own localStorage key so it isn't included in backups.
 */

export interface AiConfig {
  endpoint: string
  token: string
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

const KEY = 'calorie-tracker:ai'

export function loadAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    const c = raw ? (JSON.parse(raw) as AiConfig) : null
    return c?.endpoint && c?.token ? c : null
  } catch {
    return null
  }
}

export function saveAiConfig(c: AiConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

const base = (endpoint: string) => endpoint.trim().replace(/\/+$/, '')

async function call<T>(cfg: AiConfig, path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(base(cfg.endpoint) + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-App-Token': cfg.token, ...init?.headers },
    })
  } catch {
    throw new Error("Couldn't reach the AI server. Check the URL and your connection.")
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `AI server error (${res.status})`)
  return body
}

export function testAiConfig(cfg: AiConfig) {
  return call<{ ok: boolean; model: string }>(cfg, '/health')
}

export function estimateFromPhoto(cfg: AiConfig, imageBase64: string, note: string) {
  return call<AiEstimate>(cfg, '/estimate', { method: 'POST', body: JSON.stringify({ image: imageBase64, note }) })
}

/** Downscales a photo to a JPEG (max 1024px) and returns base64 without the data: prefix. */
export async function photoToBase64(file: File, maxSize = 1024): Promise<{ base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Older Safari: decode via <img>
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  })
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return { base64: dataUrl.split(',')[1], previewUrl: dataUrl }
}
