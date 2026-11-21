import { useCallback, useEffect, useMemo, useState } from 'react'
import { lookupBarcode, searchFoods, type FoodProduct } from '../lib/foodApi'
import { formatDayLabel } from '../lib/date'
import { store } from '../lib/useStore'
import type { AppData, DateKey, MealSlot, Nutrients, SavedMeal } from '../lib/types'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'
import { BarcodeScanner } from './BarcodeScanner'
import { FoodPicker, type PickedFood } from './FoodPicker'
import { MealForm } from './MealForm'
import { toast } from './toast'
import { MacroLine, NumberField, Segmented, Sheet, kcal, toNum } from './ui'

type Tab = 'quick' | 'meals' | 'recent' | 'search' | 'scan'

export function AddFoodSheet({
  open,
  onClose,
  date,
  initialSlot,
  data,
}: {
  open: boolean
  onClose: () => void
  date: DateKey
  initialSlot: MealSlot
  data: AppData
}) {
  const [slot, setSlot] = useState<MealSlot>(initialSlot)
  const [tab, setTab] = useState<Tab>(data.savedMeals.length ? 'meals' : 'quick')

  useEffect(() => {
    if (open) setSlot(initialSlot)
  }, [open, initialSlot])

  const add = (f: {
    name: string
    nutrients: Nutrients
    servings: number
    servingLabel?: string
    source: 'quick' | 'saved' | 'food'
    savedMealId?: string
    barcode?: string
    saveToMeals?: boolean
  }) => {
    let savedMealId = f.savedMealId
    if (f.saveToMeals) {
      const existing = data.savedMeals.find((m) => m.name.toLowerCase() === f.name.toLowerCase())
      savedMealId = existing
        ? existing.id
        : store.saveMeal({ name: f.name, nutrients: f.nutrients, servingLabel: f.servingLabel, barcode: f.barcode }).id
    }
    const entry = store.addEntry({
      date,
      slot,
      name: f.name,
      nutrients: f.nutrients,
      servings: f.servings,
      servingLabel: f.servingLabel,
      source: f.source,
      savedMealId,
      barcode: f.barcode,
    })
    toast(`Added ${f.name} to ${SLOT_LABELS[slot]}`, { label: 'Undo', run: () => store.deleteEntry(entry.id) })
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${formatDayLabel(date)}`}>
      <div className="slot-pick">
        {MEAL_SLOTS.map((s) => (
          <button key={s} className={`chip ${s === slot ? 'active' : ''}`} onClick={() => setSlot(s)}>
            {SLOT_LABELS[s]}
          </button>
        ))}
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'quick', label: 'Quick add' },
          { value: 'meals', label: 'My meals' },
          { value: 'recent', label: 'Recent' },
          { value: 'search', label: 'Search' },
          { value: 'scan', label: 'Scan' },
        ]}
      />
      <div className="tab-body">
        {tab === 'quick' && (
          <MealForm
            key={`${date}-${slot}`}
            submitLabel="Add to diary"
            showSaveToggle
            onSubmit={(v) => {
              add({ ...v, source: 'quick' })
              onClose()
            }}
          />
        )}
        {tab === 'meals' && <SavedMealsTab meals={data.savedMeals} onAdd={add} onGoQuick={() => setTab('quick')} />}
        {tab === 'recent' && <RecentTab data={data} onAdd={add} />}
        {tab === 'search' && <SearchTab onAdd={(f) => add({ ...f, source: 'food' })} />}
        {tab === 'scan' && <ScanTab onAdd={(f) => add({ ...f, source: 'food' })} />}
      </div>
    </Sheet>
  )
}

type AddFn = (f: {
  name: string
  nutrients: Nutrients
  servings: number
  servingLabel?: string
  source: 'quick' | 'saved' | 'food'
  savedMealId?: string
  barcode?: string
}) => void

function ServingRow({
  name,
  nutrients,
  servingLabel,
  sub,
  onAdd,
}: {
  name: string
  nutrients: Nutrients
  servingLabel?: string
  sub?: string
  onAdd: (servings: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [servings, setServings] = useState('1')
  return (
    <li className="list-item">
      <div className="row">
        <button className="grow text-left plain" onClick={() => setExpanded(!expanded)}>
          <div className="item-name">{name}</div>
          <div className="muted small">
            {kcal(nutrients.calories)} kcal{servingLabel ? ` · ${servingLabel}` : ''}
            {sub ? ` · ${sub}` : ''}
          </div>
        </button>
        <button className="add-btn" aria-label={`Add ${name}`} onClick={() => onAdd(1)}>
          +
        </button>
      </div>
      {expanded && (
        <div className="row gap expand">
          <MacroLine n={nutrients} className="grow" />
          <div style={{ width: 110 }}>
            <NumberField label="Servings" value={servings} onChange={setServings} step="0.25" />
          </div>
          <button className="btn primary" disabled={toNum(servings) <= 0} onClick={() => onAdd(toNum(servings))}>
            Add
          </button>
        </div>
      )}
    </li>
  )
}

function SavedMealsTab({ meals, onAdd, onGoQuick }: { meals: SavedMeal[]; onAdd: AddFn; onGoQuick: () => void }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'used' | 'recent' | 'az'>('used')
  const list = useMemo(() => {
    const filtered = meals.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
    return filtered.sort((a, b) =>
      sort === 'az'
        ? a.name.localeCompare(b.name)
        : sort === 'recent'
          ? (b.lastUsed ?? b.createdAt) - (a.lastUsed ?? a.createdAt)
          : b.useCount - a.useCount || a.name.localeCompare(b.name),
    )
  }, [meals, q, sort])

  if (!meals.length)
    return (
      <div className="empty">
        <p>No saved meals yet.</p>
        <p className="muted small">Tick "Also save to My Meals" when quick adding, or create meals in Settings → My meals.</p>
        <button className="btn" onClick={onGoQuick}>
          Quick add a meal
        </button>
      </div>
    )
  return (
    <div className="stack">
      <div className="row gap">
        <input className="grow" placeholder="Filter my meals" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="used">Most used</option>
          <option value="recent">Recent</option>
          <option value="az">A–Z</option>
        </select>
      </div>
      <ul className="list">
        {list.map((m) => (
          <ServingRow
            key={m.id}
            name={m.name}
            nutrients={m.nutrients}
            servingLabel={m.servingLabel}
            onAdd={(servings) =>
              onAdd({ name: m.name, nutrients: m.nutrients, servings, servingLabel: m.servingLabel, source: 'saved', savedMealId: m.id })
            }
          />
        ))}
      </ul>
    </div>
  )
}

function RecentTab({ data, onAdd }: { data: AppData; onAdd: AddFn }) {
  const recent = useMemo(() => {
    const seen = new Map<string, AppData['entries'][number]>()
    ;[...data.entries]
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((e) => {
        const k = e.name.toLowerCase() + '|' + e.nutrients.calories
        if (!seen.has(k)) seen.set(k, e)
      })
    return [...seen.values()].slice(0, 40)
  }, [data.entries])
  if (!recent.length) return <p className="empty muted">Foods you log will show up here.</p>
  return (
    <ul className="list">
      {recent.map((e) => (
        <ServingRow
          key={e.id}
          name={e.name}
          nutrients={e.nutrients}
          servingLabel={e.servingLabel}
          sub={e.servings !== 1 ? `last: ${e.servings}×` : undefined}
          onAdd={(servings) =>
            onAdd({
              name: e.name,
              nutrients: e.nutrients,
              servings,
              servingLabel: e.servingLabel,
              source: e.source,
              savedMealId: e.savedMealId,
              barcode: e.barcode,
            })
          }
        />
      ))}
    </ul>
  )
}

function SearchTab({ onAdd }: { onAdd: (f: PickedFood) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodProduct[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<FoodProduct | null>(null)

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResults(await searchFoods(q.trim()))
    } catch {
      setError('Search failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (picked) return <FoodPicker product={picked} onBack={() => setPicked(null)} onAdd={(f) => { onAdd(f); setPicked(null) }} />

  return (
    <div className="stack">
      <form className="row gap" onSubmit={run}>
        <input className="grow" type="search" placeholder="Search foods (e.g. oat milk)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <button className="btn primary" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </form>
      {error && <p className="hint warn">{error}</p>}
      {results && !results.length && <p className="muted">No results. Try a different term, or use Quick add.</p>}
      {results && (
        <ul className="list">
          {results.map((p) => (
            <li key={p.code} className="list-item">
              <button className="plain text-left full" onClick={() => setPicked(p)}>
                <div className="item-name">{p.name}</div>
                <div className="muted small">
                  {p.brand ? `${p.brand} · ` : ''}
                  {kcal(p.per100g.calories)} kcal / 100 g
                  {p.perServing && p.servingSize ? ` · ${kcal(p.perServing.calories)} kcal / ${p.servingSize}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ScanTab({ onAdd }: { onAdd: (f: PickedFood) => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [product, setProduct] = useState<FoodProduct | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle')

  const onDetected = useCallback(async (c: string) => {
    setCode(c)
    setStatus('loading')
    try {
      const p = await lookupBarcode(c)
      if (p) {
        setProduct(p)
        setStatus('idle')
      } else setStatus('notfound')
    } catch {
      setStatus('error')
    }
  }, [])

  const reset = () => {
    setCode(null)
    setProduct(null)
    setStatus('idle')
  }

  if (product) return <FoodPicker product={product} onBack={reset} onAdd={(f) => { onAdd(f); reset() }} />
  if (!code) return <BarcodeScanner onDetected={onDetected} />
  return (
    <div className="stack center">
      {status === 'loading' && <p>Looking up {code}…</p>}
      {status === 'notfound' && <p>No product found for barcode {code}. Use Quick add instead, or try again.</p>}
      {status === 'error' && <p>Lookup failed. Check your connection.</p>}
      {status !== 'loading' && (
        <button className="btn" onClick={reset}>
          Scan again
        </button>
      )}
    </div>
  )
}
