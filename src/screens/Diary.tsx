import { useState } from 'react'
import { MealForm } from '../components/MealForm'
import { toast } from '../components/toast'
import { MacroLine, NumberField, Ring, Sheet, fmt, kcal, toNum } from '../components/ui'
import { IconChevronLeft, IconChevronRight, IconCopy, IconDrop, IconPlus, IconRun } from '../components/Icons'
import { addDays, formatDayLabel, fromDateKey, today } from '../lib/date'
import { daySummary, entriesFor, entryTotal, sumEntries } from '../lib/nutrition'
import { displayWater, waterIncrements } from '../lib/units'
import { store } from '../lib/useStore'
import type { AppData, DateKey, FoodEntry, MealSlot } from '../lib/types'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'

const MEAL_EMOJI: Record<MealSlot, string> = { breakfast: '🍳', lunch: '🍜', dinner: '🍛', snacks: '🧋' }

/** Monday-start week containing `d`. */
function weekOf(d: DateKey): DateKey[] {
  const day = (fromDateKey(d).getDay() + 6) % 7
  const start = addDays(d, -day)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function WeekStrip({ date, setDate, data }: { date: DateKey; setDate: (d: DateKey) => void; data: AppData }) {
  const days = weekOf(date)
  const t = today()
  const logged = new Set(data.entries.map((e) => e.date))
  return (
    <div className="week">
      <button className="week-nav" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}>
        <IconChevronLeft size={20} />
      </button>
      <div className="week-days">
        {days.map((d) => {
          const dt = fromDateKey(d)
          return (
            <button
              key={d}
              className={`week-day ${d === date ? 'selected' : ''} ${d === t ? 'today' : ''} ${d > t ? 'future' : ''}`}
              onClick={() => setDate(d)}
              aria-label={formatDayLabel(d)}
              aria-current={d === date ? 'date' : undefined}
            >
              <span className="wd">{dt.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span className="dn">{dt.getDate()}</span>
              <span className={`dot ${logged.has(d) ? 'on' : ''}`} />
            </button>
          )
        })}
      </div>
      <button className="week-nav" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}>
        <IconChevronRight size={20} />
      </button>
    </div>
  )
}

function MacroRing({ label, value, goal, cls }: { label: string; value: number; goal: number; cls: string }) {
  return (
    <div className={`macro-ring ${cls}`}>
      <Ring value={value} goal={goal} size={74} stroke={8}>
        <b>{fmt(value)}</b>
        <span>/{goal}g</span>
      </Ring>
      <span className="macro-label">{label}</span>
    </div>
  )
}

export function Diary({
  data,
  date,
  setDate,
  onAdd,
}: {
  data: AppData
  date: DateKey
  setDate: (d: DateKey) => void
  onAdd: (slot: MealSlot) => void
}) {
  const s = daySummary(data, date)
  const g = data.settings.goals
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const over = s.remaining < 0
  const pct = s.goal > 0 ? Math.min(100, Math.round((s.food.calories / s.goal) * 100)) : 0
  const waterPct = g.waterMl > 0 ? Math.min(100, (s.water / g.waterMl) * 100) : 0
  const exercises = data.exercise.filter((x) => x.date === date)

  return (
    <div className="screen diary">
      <WeekStrip date={date} setDate={setDate} data={data} />
      {date !== today() && (
        <button className="link center-text small" onClick={() => setDate(today())}>
          Back to today
        </button>
      )}

      <section className={`hero-card ${over ? 'over' : ''}`}>
        <div className="hero-text">
          <p className="hero-eyebrow">{over ? 'Over your goal' : 'Calories left'}</p>
          <p className="hero-number">{kcal(Math.abs(s.remaining))}</p>
          <p className="hero-sub">
            {kcal(s.food.calories)} eaten · {kcal(s.goal)} goal
          </p>
          {s.exercise > 0 && (
            <p className="hero-chip">
              <IconRun size={16} /> {kcal(s.exercise)} kcal burned
            </p>
          )}
        </div>
        <Ring value={s.food.calories} goal={s.goal} size={112} stroke={12} className="on-color">
          <b>{pct}%</b>
        </Ring>
      </section>

      <section className="card macros-card">
        <MacroRing label="Protein" value={s.food.protein} goal={g.protein} cls="p" />
        <MacroRing label="Carbs" value={s.food.carbs} goal={g.carbs} cls="c" />
        <MacroRing label="Fat" value={s.food.fat} goal={g.fat} cls="f" />
      </section>

      <h2 className="section-title">Meals</h2>
      {MEAL_SLOTS.map((slot) => {
        const list = entriesFor(data, date, slot)
        const total = sumEntries(list)
        const canCopy = !list.length && entriesFor(data, addDays(date, -1), slot).length > 0
        return (
          <section key={slot} className={`meal-card ${slot}`}>
            <header className="meal-head">
              <span className="meal-emoji" aria-hidden>
                {MEAL_EMOJI[slot]}
              </span>
              <div className="grow">
                <h3>{SLOT_LABELS[slot]}</h3>
                <p className="meal-meta">
                  {list.length ? (
                    <>
                      {kcal(total.calories)} kcal · <MacroLine n={total} />
                    </>
                  ) : (
                    'Nothing logged yet'
                  )}
                </p>
              </div>
            </header>
            {list.length > 0 && (
              <ul className="meal-items">
                {list.map((e) => {
                  const t = entryTotal(e)
                  return (
                    <li key={e.id}>
                      <button className="meal-item" onClick={() => setEditing(e)}>
                        <span className="grow">
                          <span className="item-name">{e.name}</span>
                          <span className="item-sub">
                            {e.servings !== 1 ? `${fmt(e.servings)} × ` : ''}
                            {e.servingLabel ?? (e.servings !== 1 ? 'serving' : '')}
                          </span>
                        </span>
                        <span className="kcal">{kcal(t.calories)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="meal-actions">
              <button className="pill-btn" onClick={() => onAdd(slot)}>
                <IconPlus size={18} strokeWidth={2.4} /> Add
              </button>
              {canCopy && (
                <button
                  className="pill-btn ghost"
                  onClick={() => {
                    const n = store.copyEntries(addDays(date, -1), date, slot)
                    toast(`Copied ${n} item${n === 1 ? '' : 's'} from yesterday`)
                  }}
                >
                  <IconCopy size={16} /> Copy yesterday
                </button>
              )}
            </div>
          </section>
        )
      })}

      <h2 className="section-title">Activity</h2>
      <section className="water-card">
        <div className="water-fill" style={{ height: `${waterPct}%` }} />
        <div className="water-content">
          <header className="meal-head">
            <span className="meal-emoji" aria-hidden>
              <IconDrop size={22} />
            </span>
            <div className="grow">
              <h3>Water</h3>
              <p className="meal-meta">
                {displayWater(s.water, data.settings.waterUnit)} of {displayWater(g.waterMl, data.settings.waterUnit)}
              </p>
            </div>
          </header>
          <div className="row gap wrap">
            {waterIncrements(data.settings.waterUnit).map((w) => (
              <button key={w.label} className="pill-btn" onClick={() => store.addWater(date, w.ml)}>
                {w.label}
              </button>
            ))}
            {s.water > 0 && (
              <button className="pill-btn ghost" onClick={() => store.addWater(date, -waterIncrements(data.settings.waterUnit)[0].ml)}>
                Undo
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card exercise-card">
        <header className="meal-head">
          <span className="meal-emoji" aria-hidden>
            <IconRun size={22} />
          </span>
          <div className="grow">
            <h3>Exercise</h3>
            <p className="meal-meta">{s.exercise ? `${kcal(s.exercise)} kcal burned · not counted in your budget` : 'Nothing logged yet'}</p>
          </div>
        </header>
        {exercises.length > 0 && (
          <ul className="meal-items">
            {exercises.map((x) => (
              <li key={x.id} className="meal-item static">
                <span className="grow">
                  <span className="item-name">{x.name}</span>
                  {x.minutes ? <span className="item-sub">{x.minutes} min</span> : null}
                </span>
                <span className="kcal">{kcal(x.calories)}</span>
                <button className="icon-btn small" aria-label="Delete exercise" onClick={() => store.deleteExercise(x.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="meal-actions">
          <button className="pill-btn dark" onClick={() => setExerciseOpen(true)}>
            <IconPlus size={18} strokeWidth={2.4} /> Add exercise
          </button>
        </div>
      </section>

      <EntryEditor entry={editing} onClose={() => setEditing(null)} />
      <ExerciseSheet open={exerciseOpen} date={date} onClose={() => setExerciseOpen(false)} />
    </div>
  )
}

function EntryEditor({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title="Edit entry">
      {entry && <EntryEditorBody key={entry.id} entry={entry} onClose={onClose} />}
    </Sheet>
  )
}

function EntryEditorBody({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const [slot, setSlot] = useState<MealSlot>(entry.slot)
  return (
        <div className="stack">
          <label className="field">
            <span>Meal</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <MealForm
            key={entry.id}
            initial={entry}
            submitLabel="Save changes"
            onSubmit={(v) => {
              store.updateEntry(entry.id, {
                name: v.name,
                nutrients: v.nutrients,
                servings: v.servings,
                servingLabel: v.servingLabel,
                slot,
              })
              onClose()
            }}
          />
          <div className="row gap">
            <button
              className="btn ghost grow"
              onClick={() => {
                store.saveMeal({ name: entry.name, nutrients: entry.nutrients, servingLabel: entry.servingLabel, barcode: entry.barcode })
                toast(`Saved "${entry.name}" to My Meals`)
              }}
            >
              ☆ Save to My Meals
            </button>
            <button
              className="btn danger grow"
              onClick={() => {
                const copy = entry
                store.deleteEntry(entry.id)
                onClose()
                toast(`Deleted ${copy.name}`, {
                  label: 'Undo',
                  run: () => store.addEntry({ ...copy }),
                })
              }}
            >
              Delete
            </button>
          </div>
        </div>
  )
}

const EXERCISE_PRESETS: { name: string; kcalPerMin: number }[] = [
  { name: 'Walking', kcalPerMin: 4 },
  { name: 'Running', kcalPerMin: 11 },
  { name: 'Cycling', kcalPerMin: 8 },
  { name: 'Weight training', kcalPerMin: 5 },
  { name: 'Swimming', kcalPerMin: 9 },
  { name: 'HIIT', kcalPerMin: 12 },
]

function ExerciseSheet({ open, date, onClose }: { open: boolean; date: DateKey; onClose: () => void }) {
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState('')
  const [calories, setCalories] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (toNum(calories) <= 0) return
          store.addExercise({ date, name: name.trim() || 'Exercise', calories: Math.round(toNum(calories)), minutes: toNum(minutes) || undefined })
          setName('')
          setMinutes('')
          setCalories('')
          onClose()
        }}
      >
        <div className="row gap wrap">
          {EXERCISE_PRESETS.map((p) => (
            <button
              type="button"
              key={p.name}
              className={`chip ${name === p.name ? 'active' : ''}`}
              onClick={() => {
                setName(p.name)
                if (toNum(minutes)) setCalories(String(Math.round(toNum(minutes) * p.kcalPerMin)))
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Activity</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5k run" />
        </label>
        <div className="grid-2">
          <NumberField
            label="Duration"
            value={minutes}
            suffix="min"
            step="1"
            onChange={(v) => {
              setMinutes(v)
              const preset = EXERCISE_PRESETS.find((p) => p.name === name)
              if (preset && toNum(v)) setCalories(String(Math.round(toNum(v) * preset.kcalPerMin)))
            }}
          />
          <NumberField label="Calories burned" value={calories} onChange={setCalories} suffix="kcal" step="1" />
        </div>
        <p className="muted small">Preset estimates are rough averages — use your watch's number if you have one.</p>
        <button className="btn primary" disabled={toNum(calories) <= 0}>
          Add exercise
        </button>
      </form>
    </Sheet>
  )
}
