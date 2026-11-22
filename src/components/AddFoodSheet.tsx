import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconPlus } from './Icons'
import { lookupBarcode, searchFoods, type FoodProduct } from '../lib/foodApi'
import { formatDayLabel } from '../lib/date'
import { store } from '../lib/useStore'
import type { AppData, DateKey, FoodEntry, MealSlot, Nutrients, SavedMeal } from '../lib/types'
import { foodKey, recentFoods, recentMeals, usualFoods } from '../lib/insights'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'
import { BarcodeScanner } from './BarcodeScanner'
import { FoodPicker, type PickedFood } from './FoodPicker'
import { MealForm } from './MealForm'
import { toast } from './toast'
import { MacroLine, NumberField, Segmented, Sheet, fmt, kcal, toNum } from './ui'
import { HawkerPicker } from './HawkerPicker'
import { POPULAR_SG_DISHES, searchSgDishes, type SgDish } from '../lib/sgFoods'

export type Tab = 'quick' | 'meals' | 'recent' | 'search' | 'scan'

export function AddFoodSheet({
  open,
  onClose,
  date,
  initialSlot,
  initialTab,
  data,
}: {
  open: boolean
  onClose: () => void
  date: DateKey
  initialSlot: MealSlot
  initialTab?: Tab
  data: AppData
}) {
  const [slot, setSlot] = useState<MealSlot>(initialSlot)
  const [tab, setTab] = useState<Tab>(data.entries.length ? 'recent' : 'search')

  useEffect(() => {
    if (open) setSlot(initialSlot)
  }, [open, initialSlot])
  useEffect(() => {
    if (open && initialTab) setTab(initialTab)
  }, [open, initialTab])

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
    <Sheet tall open={open} onClose={onClose} title={`Add to ${formatDayLabel(date)}`}>
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
        {tab === 'recent' && <RecentTab data={data} date={date} slot={slot} onAdd={add} />}
        {tab === 'search' && <SearchTab onAdd={(f) => add({ ...f, source: 'food' })} />}
        {tab === 'scan' && (
          <BarcodeTab onAdd={(f) => add({ ...f, source: 'food' })} />
        )}
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

/** Round "+" that flips to a green tick for a moment, so repeated adds from one list feel confirmed. */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      className={`add-btn ${done ? 'done' : ''}`}
      aria-label={label}
      onClick={() => {
        onClick()
        setDone(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <IconCheck size={20} strokeWidth={2.8} /> : <IconPlus size={20} strokeWidth={2.6} />}
    </button>
  )
}

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
        <AddButton label={`Add ${name}`} onClick={() => onAdd(1)} />
      </div>
      {expanded && (
        <div className="row gap expand">
          <MacroLine n={nutrients} className="grow" />
          <div className="servings-input">
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

function RecentTab({ data, date, slot, onAdd }: { data: AppData; date: DateKey; slot: MealSlot; onAdd: AddFn }) {
  const usual = useMemo(() => usualFoods(data, slot), [data, slot])
  const usualKeys = new Set(usual.map((u) => u.entry.id))
  const recent = useMemo(() => recentFoods(data, slot), [data, slot])
  const meals = useMemo(() => recentMeals(data, date), [data, date])
  if (!recent.length) return <p className="empty muted">Foods you log will show up here.</p>

  const row = (e: FoodEntry, sub?: string) => (
    <ServingRow
      // Keyed by food, not entry id: adding makes a newer entry, and the row (and its ✓ feedback) should survive that.
      key={foodKey(e)}
      name={e.name}
      nutrients={e.nutrients}
      servingLabel={e.servingLabel}
      sub={sub ?? (e.servings !== 1 ? `last: ${fmt(e.servings)}×` : undefined)}
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
  )

  return (
    <div className="stack">
      {usual.length > 0 && (
        <section>
          <h4 className="section-label">Your usual {SLOT_LABELS[slot].toLowerCase()}</h4>
          <ul className="list">{usual.map((u) => row(u.entry, `${u.slotCount}× at ${SLOT_LABELS[slot].toLowerCase()}`))}</ul>
        </section>
      )}
      {meals.length > 0 && (
        <section>
          <h4 className="section-label">Log a whole meal again</h4>
          <ul className="list">
            {meals.map((m) => (
              <li key={`${m.date}-${m.slot}`} className="list-item">
                <div className="row">
                  <div className="grow">
                    <div className="item-name">{m.entries.map((e) => e.name).join(' + ')}</div>
                    <div className="muted small">
                      {kcal(m.calories)} kcal · {SLOT_LABELS[m.slot]}, {formatDayLabel(m.date).toLowerCase()}
                    </div>
                  </div>
                  <AddButton
                    label={`Add all ${m.entries.length} items from ${SLOT_LABELS[m.slot]} ${formatDayLabel(m.date)}`}
                    onClick={() => {
                      const copies = store.copyEntries(m.date, date, m.slot, slot)
                      toast(`Added ${copies.length} items to ${SLOT_LABELS[slot]}`, {
                        label: 'Undo',
                        run: () => store.deleteEntries(copies.map((c) => c.id)),
                      })
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h4 className="section-label">Recent</h4>
        <ul className="list">{recent.filter((r) => !usualKeys.has(r.entry.id)).map((r) => row(r.entry))}</ul>
      </section>
    </div>
  )
}

function SgDishRow({ dish, onPick }: { dish: SgDish; onPick: () => void }) {
  return (
    <li className="list-item">
      <button className="plain text-left full row between" onClick={onPick}>
        <span>
          <span className="item-name">{dish.name}</span>
          <span className="muted small">
            {dish.serving} · {kcal(dish.n.calories)} kcal{dish.oilG >= 15 ? ' · oily' : ''}
          </span>
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>
    </li>
  )
}

function SearchTab({ onAdd }: { onAdd: (f: PickedFood) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodProduct[] | null>(null)
  const [searchedFor, setSearchedFor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<FoodProduct | null>(null)
  const [dish, setDish] = useState<SgDish | null>(null)
  const sg = useMemo(() => searchSgDishes(q, 8), [q])

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    setLoading(true)
    setError(null)
    try {
      setResults(await searchFoods(term))
      setSearchedFor(term)
    } catch {
      setError("Packaged-food search isn't responding right now. Hawker dishes above still work, or try again in a minute.")
    } finally {
      setLoading(false)
    }
  }

  if (dish) return <HawkerPicker dish={dish} onBack={() => setDish(null)} onAdd={(f) => { onAdd(f); setDish(null) }} />
  if (picked) return <FoodPicker product={picked} onBack={() => setPicked(null)} onAdd={(f) => { onAdd(f); setPicked(null) }} />

  return (
    <div className="stack">
      <form className="row gap" onSubmit={run}>
        <input
          className="grow"
          type="search"
          placeholder="e.g. chicken rice, milo, oat milk"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (results && e.target.value.trim() !== searchedFor) setResults(null)
          }}
          enterKeyHint="search"
        />
        <button className="btn primary" disabled={loading || !q.trim()}>
          {loading ? <span className="spinner small" aria-label="Searching" /> : 'Search'}
        </button>
      </form>

      {!q.trim() && (
        <section>
          <h4 className="section-label">Popular hawker dishes</h4>
          <ul className="list">
            {POPULAR_SG_DISHES.map((d) => (
              <SgDishRow key={d.id} dish={d} onPick={() => setDish(d)} />
            ))}
          </ul>
        </section>
      )}

      {sg.length > 0 && (
        <section>
          <h4 className="section-label">🇸🇬 Hawker & kopitiam</h4>
          <ul className="list">
            {sg.map((d) => (
              <SgDishRow key={d.id} dish={d} onPick={() => setDish(d)} />
            ))}
          </ul>
        </section>
      )}

      {q.trim() && !results && !loading && !error && (
        <p className="muted small">Press Search to also look up packaged foods (Open Food Facts).</p>
      )}
      {error && <p className="hint warn">{error}</p>}

      {results && (
        <section>
          <h4 className="section-label">Packaged foods</h4>
          {!results.length && <p className="muted small">No packaged foods found. Try another term, or use Quick add.</p>}
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
        </section>
      )}
    </div>
  )
}

function BarcodeTab({ onAdd }: { onAdd: (f: PickedFood) => void }) {
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
