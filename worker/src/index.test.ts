import { describe, expect, it, vi } from 'vitest'
import worker, { estimate, sanitiseEstimate, searchFoods, type Env } from './index'

const env: Env = { GEMINI_API_KEY: 'k', APP_TOKEN: 'secret', ALLOWED_ORIGINS: 'https://chiennugget.github.io' }
const geminiReply = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 })

describe('worker', () => {
  it('rejects requests without the access code', async () => {
    const res = await worker.fetch(new Request('https://w/health', { headers: { Origin: 'https://chiennugget.github.io' } }), env)
    expect(res.status).toBe(401)
  })

  it('rejects other origins', async () => {
    const res = await worker.fetch(new Request('https://w/health', { headers: { Origin: 'https://evil.example', 'X-App-Token': 'secret' } }), env)
    expect(res.status).toBe(403)
  })

  it('answers health checks with CORS headers', async () => {
    const res = await worker.fetch(
      new Request('https://w/health', { headers: { Origin: 'https://chiennugget.github.io', 'X-App-Token': 'secret' } }),
      env,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://chiennugget.github.io')
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('sends a Gemini request with the image, SG prompt and schema', async () => {
    const fetchMock = vi.fn(async () =>
      geminiReply({
        items: [{ name: 'Char kway teow', matchId: 'char_kway_teow', portion: 'large', oil: 'extra', calories: 1000, protein: 30, carbs: 100, fat: 55, confidence: 'high', notes: 'Visible oil' }],
        summary: 'One plate of CKT',
      }),
    )
    const out = await estimate('BASE64', 'shared with no one', env, fetchMock as unknown as typeof fetch)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain(':generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    const body = JSON.parse(init.body as string)
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'BASE64' })
    expect(body.systemInstruction.parts[0].text).toContain('Singapore')
    expect(body.systemInstruction.parts[0].text).toContain('char_kway_teow')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(out.items[0]).toMatchObject({ matchId: 'char_kway_teow', oil: 'extra', calories: 1000 })
  })

  it('sanitises bad model output', () => {
    const out = sanitiseEstimate({ items: [{ name: 'X', matchId: 'not_a_dish', portion: 'huge', calories: -5, fat: 'abc' }] }, 'm')
    expect(out.items[0]).toMatchObject({ matchId: '', portion: 'regular', calories: 0, fat: 0, confidence: 'low' })
  })

  it('maps Gemini quota errors to a friendly 429', async () => {
    const fetchMock = vi.fn(async () => new Response('quota', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await worker.fetch(
      new Request('https://w/estimate', {
        method: 'POST',
        headers: { Origin: 'https://chiennugget.github.io', 'X-App-Token': 'secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'abc' }),
      }),
      env,
    )
    vi.unstubAllGlobals()
    expect(res.status).toBe(429)
    expect((await res.json()).error).toMatch(/quota/)
  })

  it('proxies Open Food Facts search', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ hits: [{ code: '1', product_name: 'Milo' }] }), { status: 200 }))
    const res = await searchFoods(new Request('https://w/search?q=milo'), { 'Access-Control-Allow-Origin': 'x' }, fetchMock as unknown as typeof fetch)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain('search.openfoodfacts.org/search?q=milo')
    expect(await res.json()).toEqual({ hits: [{ code: '1', product_name: 'Milo' }] })
  })
})
