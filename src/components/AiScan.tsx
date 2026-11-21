import { useRef, useState } from 'react'
import { estimateFromPhoto, loadAiConfig, photoToBase64, type AiEstimate, type AiItem } from '../lib/aiScan'
import { SG_DISH_BY_ID, computeDish, describeDish, type DishOptions } from '../lib/sgFoods'
import type { Nutrients } from '../lib/types'
import type { PickedFood } from './FoodPicker'
import { DishOptionsEditor } from './HawkerPicker'
import { MacroLine, NumberField, kcal, toNum } from './ui'

interface ReviewItem {
  include: boolean
  name: string
  ai: AiItem
  /** When matched to the hawker DB and not overridden, nutrients come from the DB + options. */
  useDb: boolean
  opts: DishOptions
  custom: { calories: string; protein: string; carbs: string; fat: string }
}

const toReview = (it: AiItem): ReviewItem => ({
  include: true,
  name: it.name,
  ai: it,
  useDb: !!SG_DISH_BY_ID[it.matchId],
  opts: { portion: it.portion, oil: it.oil, addOns: {} },
  custom: { calories: String(it.calories), protein: String(it.protein), carbs: String(it.carbs), fat: String(it.fat) },
})

function itemNutrients(r: ReviewItem): Nutrients {
  const dish = SG_DISH_BY_ID[r.ai.matchId]
  if (r.useDb && dish) return computeDish(dish, r.opts)
  return { calories: Math.round(toNum(r.custom.calories)), protein: toNum(r.custom.protein), carbs: toNum(r.custom.carbs), fat: toNum(r.custom.fat) }
}

export function AiScan({ onAdd, onOpenSettings }: { onAdd: (items: PickedFood[]) => void; onOpenSettings?: () => void }) {
  const cfg = loadAiConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'review' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AiEstimate | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])

  if (!cfg)
    return (
      <div className="empty">
        <p>AI photo estimates aren't set up yet.</p>
        <p className="muted small">It needs a small free server with your Gemini key. Setup takes about 10 minutes.</p>
        {onOpenSettings && (
          <button className="btn" onClick={onOpenSettings}>
            Set up AI food scan
          </button>
        )}
      </div>
    )

  const run = async (file: File) => {
    setStatus('loading')
    setError('')
    try {
      const { base64, previewUrl } = await photoToBase64(file)
      setPreview(previewUrl)
      const r = await estimateFromPhoto(cfg, base64, note.trim())
      setResult(r)
      setItems(r.items.map(toReview))
      setStatus('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle')
    setPreview(null)
    setResult(null)
    setItems([])
  }
  const update = (i: number, patch: Partial<ReviewItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  const included = items.filter((i) => i.include)
  const total = included.reduce((s, r) => s + itemNutrients(r).calories, 0)

  return (
    <div className="stack">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) run(f)
        }}
      />

      {status === 'idle' || status === 'error' ? (
        <>
          <button className="photo-btn" onClick={() => fileRef.current?.click()}>
            <span aria-hidden>📸</span>
            Take or choose a food photo
          </button>
          <label className="field">
            <span>Anything the photo can't show? (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. less rice, added 2 chicken wings, shared" />
          </label>
          {status === 'error' && <p className="hint warn">{error}</p>}
          <p className="muted small">
            Tuned for Singapore hawker food. You'll review and adjust the estimate before anything is added.
          </p>
        </>
      ) : null}

      {preview && <img className="photo-preview" src={preview} alt="Your food" />}

      {status === 'loading' && (
        <div className="ai-loading">
          <span className="spinner" aria-hidden />
          Estimating…
        </div>
      )}

      {status === 'review' && result && (
        <>
          {result.summary && <p className="muted small">{result.summary}</p>}
          {!items.length && <p>No food detected. Try another photo.</p>}
          {items.map((r, i) => {
            const dish = SG_DISH_BY_ID[r.ai.matchId]
            const n = itemNutrients(r)
            return (
              <div key={i} className={`card tight ai-item ${r.include ? '' : 'off'}`}>
                <div className="row gap">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} aria-label="Include" />
                  <input className="grow" value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Name" />
                </div>
                {r.include && (
                  <>
                    <div className="row between small">
                      <span className={`conf ${r.ai.confidence}`}>{r.ai.confidence} confidence</span>
                      {dish && <span className="muted">Matched: {dish.name}</span>}
                    </div>
                    {r.ai.notes && <p className="muted small">{r.ai.notes}</p>}
                    {dish && r.useDb ? (
                      <>
                        <DishOptionsEditor dish={dish} value={r.opts} onChange={(opts) => update(i, { opts })} />
                        <button className="link small" onClick={() => update(i, { useDb: false })}>
                          Use AI's numbers instead ({kcal(r.ai.calories)} kcal)
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="grid-2">
                          {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                            <NumberField
                              key={k}
                              label={k[0].toUpperCase() + k.slice(1)}
                              suffix={k === 'calories' ? 'kcal' : 'g'}
                              value={r.custom[k]}
                              onChange={(v) => update(i, { custom: { ...r.custom, [k]: v } })}
                            />
                          ))}
                        </div>
                        {dish && (
                          <button className="link small" onClick={() => update(i, { useDb: true })}>
                            Use hawker database with portion / oil options
                          </button>
                        )}
                      </>
                    )}
                    <div className="row between">
                      <MacroLine n={n} />
                      <b>{kcal(n.calories)} kcal</b>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          <div className="row gap">
            <button className="btn ghost" onClick={reset}>
              Retake
            </button>
            <button
              className="btn primary grow"
              disabled={!included.length}
              onClick={() => {
                onAdd(
                  included.map((r) => {
                    const dish = SG_DISH_BY_ID[r.ai.matchId]
                    const name = dish && r.useDb && r.name === r.ai.name ? describeDish(dish, r.opts) : r.name
                    return { name, nutrients: itemNutrients(r), servings: 1, servingLabel: dish?.serving ?? '1 serving', saveToMeals: false }
                  }),
                )
                reset()
              }}
            >
              Add {included.length > 1 ? `${included.length} items · ` : ''}
              {kcal(total)} kcal
            </button>
          </div>
          <p className="muted small">AI estimates can be off by 20–30%+, especially for oil and hidden ingredients.</p>
        </>
      )}
    </div>
  )
}
