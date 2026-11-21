import { useState } from 'react'
import { MealForm } from '../components/MealForm'
import { toast } from '../components/toast'
import { MacroLine, NumberField, ProgressBar, Ring, Sheet, fmt, kcal, toNum } from '../components/ui'
import { addDays, formatDayLabel, today } from '../lib/date'
import { daySummary, entriesFor, entryTotal, loggingStreak, sumEntries } from '../lib/nutrition'
import { displayWater, waterIncrements } from '../lib/units'
import { store } from '../lib/useStore'
import type { AppData, DateKey, FoodEntry, MealSlot } from '../lib/types'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'

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
  const streak = loggingStreak(data, today())
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [exerciseOpen, setExerciseOpen] = useState(false)

  return (
    <div className="screen">
      <div className="date-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <label className="date-label">
          {formatDayLabel(date)}
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
      </div>
      {date !== today() && (
        <button className="link center-text" onClick={() => setDate(today())}>
          Jump to today
        </button>
      )}

      <section className="card summary">
        <Ring value={s.food.calories} goal={s.goal + (data.settings.addExerciseToBudget ? s.exercise : 0)} size={132}>
          <div className={`big ${s.remaining < 0 ? 'neg' : ''}`}>{kcal(Math.abs(s.remaining))}</div>
          <div className="muted small">{s.remaining < 0 ? 'over' : 'remaining'}</div>
        </Ring>
        <div className="equation">
          <div>
            <b>{kcal(s.goal)}</b>
            <span>Goal</span>
          </div>
          <div>
            <b>− {kcal(s.food.calories)}</b>
            <span>Food</span>
          </div>
          {data.settings.addExerciseToBudget && (
            <div>
              <b>+ {kcal(s.exercise)}</b>
              <span>Exercise</span>
            </div>
          )}
        </div>
        <div className="macros">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} className={`macro ${k[0]}`}>
              <div className="macro-head">
                <span>{k[0].toUpperCase() + k.slice(1)}</span>
                <b>
                  {fmt(s.food[k])}
                  <small> / {g[k]} g</small>
                </b>
              </div>
              <ProgressBar value={s.food[k]} goal={g[k]} className={k[0]} />
            </div>
          ))}
        </div>
        {streak > 1 && <p className="streak">🔥 {streak}-day logging streak</p>}
      </section>

      {MEAL_SLOTS.map((slot) => {
        const list = entriesFor(data, date, slot)
        const total = sumEntries(list)
        return (
          <section key={slot} className="card meal">
            <header className="row between">
              <h3>{SLOT_LABELS[slot]}</h3>
              <span className="muted">{list.length ? `${kcal(total.calories)} kcal` : ''}</span>
            </header>
            {list.length > 0 && (
              <ul className="list">
                {list.map((e) => {
                  const t = entryTotal(e)
                  return (
                    <li key={e.id} className="list-item">
                      <button className="plain text-left full row between" onClick={() => setEditing(e)}>
                        <div>
                          <div className="item-name">{e.name}</div>
                          <div className="muted small">
                            {e.servings !== 1 ? `${fmt(e.servings)} × ` : ''}
                            {e.servingLabel ? `${e.servingLabel} · ` : e.servings !== 1 ? 'serving · ' : ''}
                            <MacroLine n={t} />
                          </div>
                        </div>
                        <span className="kcal">{kcal(t.calories)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="row between meal-actions">
              <button className="link" onClick={() => onAdd(slot)}>
                + Add food
              </button>
              {!list.length && entriesFor(data, addDays(date, -1), slot).length > 0 && (
                <button
                  className="link muted"
                  onClick={() => {
                    const n = store.copyEntries(addDays(date, -1), date, slot)
                    toast(`Copied ${n} item${n === 1 ? '' : 's'} from yesterday`)
                  }}
                >
                  Copy yesterday
                </button>
              )}
            </div>
          </section>
        )
      })}

      <section className="card">
        <header className="row between">
          <h3>Water</h3>
          <span className="muted">
            {displayWater(s.water, data.settings.waterUnit)} / {displayWater(g.waterMl, data.settings.waterUnit)}
          </span>
        </header>
        <ProgressBar value={s.water} goal={g.waterMl} className="water" />
        <div className="row gap wrap water-btns">
          {waterIncrements(data.settings.waterUnit).map((w) => (
            <button key={w.label} className="chip" onClick={() => store.addWater(date, w.ml)}>
              {w.label}
            </button>
          ))}
          {s.water > 0 && (
            <button className="chip ghost" onClick={() => store.addWater(date, -waterIncrements(data.settings.waterUnit)[0].ml)}>
              − undo
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <header className="row between">
          <h3>Exercise</h3>
          <span className="muted">{s.exercise ? `${kcal(s.exercise)} kcal` : ''}</span>
        </header>
        <ul className="list">
          {data.exercise
            .filter((x) => x.date === date)
            .map((x) => (
              <li key={x.id} className="list-item row between">
                <div>
                  <div className="item-name">{x.name}</div>
                  {x.minutes ? <div className="muted small">{x.minutes} min</div> : null}
                </div>
                <div className="row gap">
                  <span className="kcal">{kcal(x.calories)}</span>
                  <button className="icon-btn small" aria-label="Delete exercise" onClick={() => store.deleteExercise(x.id)}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
        </ul>
        <button className="link" onClick={() => setExerciseOpen(true)}>
          + Add exercise
        </button>
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
