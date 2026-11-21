import { useState } from 'react'
import { MealForm } from '../components/MealForm'
import { toast } from '../components/toast'
import { MacroLine, NumberField, Ring, Sheet, fmt, kcal, toNum } from '../components/ui'
import { IconChevronLeft, IconChevronRight, IconCopy, IconDrop, IconPlus, IconRun } from '../components/Icons'
import { addDays, formatDayLabel, fromDateKey, today } from '../lib/date'
import { daySummary, entriesFor, entryTotal, sumEntries } from '../lib/nutrition'
import { shouldRemindBackup, weekBudget, weekOf } from '../lib/insights'
import { downloadBackup } from '../lib/backup'
import { useCloud } from '../cloud/cloud'
import { BLOCK_MESSAGES } from '../lib/cloudBackup'
import { displayWater, waterIncrements } from '../lib/units'
import { store } from '../lib/useStore'
import type { AppData, DateKey, FoodEntry, MealSlot } from '../lib/types'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'

const MEAL_EMOJI: Record<MealSlot, string> = { breakfast: '🍳', lunch: '🍜', dinner: '🍛', snacks: '🧋' }

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
              aria-current={d === date ? 'date' : undefined}
            >
              <span className="sr-only">
                {formatDayLabel(d)}
                {logged.has(d) ? ', logged' : ''}
              </span>
              <span className="wd" aria-hidden>
                {dt.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
              <span className="dn" aria-hidden>
                {dt.getDate()}
              </span>
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
  onOpenCalculator,
  onOpenCloud,
}: {
  data: AppData
  date: DateKey
  setDate: (d: DateKey) => void
  onAdd: (slot: MealSlot) => void
  onOpenCalculator: () => void
  onOpenCloud: () => void
}) {
  const s = daySummary(data, date)
  const g = data.settings.goals
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [copying, setCopying] = useState<MealSlot | null>(null)
  const week = weekBudget(data, date)
  const [now] = useState(() => Date.now())
  const cloud = useCloud()
  const cloudOn = cloud.configured && !!cloud.email
  // Cloud uploads update meta.lastBackupAt, so with cloud on this only shows if it has stopped working for a while.
  const remindBackup = shouldRemindBackup(data, now)
  const cloudPaused = cloudOn && cloud.status === 'blocked' && cloud.block && cloud.block !== 'not-onboarded' ? cloud.block : null
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

      {!data.meta.onboarded && !data.entries.length && (
        <WelcomeCard onOpenCalculator={onOpenCalculator} onOpenCloud={cloud.configured ? onOpenCloud : undefined} />
      )}
      {cloudPaused && (
        <section className="card notice-card" role="region" aria-label="Cloud backup paused">
          <p className="small">
            <b>☁️ Cloud backup paused.</b> {BLOCK_MESSAGES[cloudPaused]}
          </p>
          <button className="btn primary" onClick={onOpenCloud}>
            Review cloud backup
          </button>
        </section>
      )}
      {remindBackup && !cloudPaused && <BackupReminder data={data} onOpenCloud={cloud.configured && !cloudOn ? onOpenCloud : undefined} />}

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

      {week.eaten > 0 && (
        <section className="card week-card" aria-label="This week">
          <div className="row between">
            <h3>This week</h3>
            <span className={`kcal ${week.remaining < 0 ? 'neg' : ''}`}>
              {week.remaining < 0 ? `${kcal(-week.remaining)} over` : `${kcal(week.remaining)} left`}
            </span>
          </div>
          <div className={`bar ${week.remaining < 0 ? 'over' : ''}`} role="progressbar" aria-label="Weekly calories" aria-valuemin={0} aria-valuemax={week.budget} aria-valuenow={Math.round(week.eaten)}>
            <div style={{ width: `${Math.min(100, (week.eaten / Math.max(1, week.budget)) * 100)}%` }} />
          </div>
          <p className="muted small">
            {kcal(week.eaten)} of {kcal(week.budget)} kcal
            {week.daysLeft > 1 && week.remaining > 0 && <> · about <b>{kcal(week.perDayLeft)}</b>/day for the next {week.daysLeft} days keeps you on track</>}
            {week.skippedDays > 0 && <> · {week.skippedDays} unlogged {week.skippedDays === 1 ? 'day' : 'days'} left out</>}
          </p>
        </section>
      )}

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
              {list.length > 0 && (
                <button className="pill-btn ghost" onClick={() => setCopying(slot)} aria-label={`Copy ${SLOT_LABELS[slot]} to another day`}>
                  <IconCopy size={16} /> Copy
                </button>
              )}
              {canCopy && (
                <button
                  className="pill-btn ghost"
                  onClick={() => {
                    const copies = store.copyEntries(addDays(date, -1), date, slot)
                    const n = copies.length
                    toast(`Copied ${n} item${n === 1 ? '' : 's'} from yesterday`, {
                      label: 'Undo',
                      run: () => store.deleteEntries(copies.map((c) => c.id)),
                    })
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
      <CopyMealSheet from={date} slot={copying} onClose={() => setCopying(null)} />
    </div>
  )
}

function WelcomeCard({ onOpenCalculator, onOpenCloud }: { onOpenCalculator: () => void; onOpenCloud?: () => void }) {
  return (
    <section className="card welcome-card">
      <h3>Welcome 👋</h3>
      <p className="small">
        Everything stays on this phone, with no account needed. Start by working out your calorie and protein targets. It takes about 30
        seconds.
      </p>
      <div className="row gap wrap">
        <button className="btn primary" onClick={onOpenCalculator}>
          Set my goals
        </button>
        <button className="btn ghost" onClick={() => store.updateMeta({ onboarded: true })}>
          Use defaults
        </button>
      </div>
      {onOpenCloud && (
        <p className="small">
          Used this app before?{' '}
          <button className="link" onClick={onOpenCloud}>
            Restore from cloud backup
          </button>
        </p>
      )}
      <p className="muted small">Tip: add this page to your home screen to use it like an app, even offline.</p>
    </section>
  )
}

function BackupReminder({ data, onOpenCloud }: { data: AppData; onOpenCloud?: () => void }) {
  const never = !data.meta.lastBackupAt
  return (
    <section className="card notice-card" role="region" aria-label="Backup reminder">
      <p className="small">
        <b>💾 {never ? "You haven't backed up yet." : 'Time for a backup.'}</b> Your diary only lives in this browser. Clearing site
        data or losing your phone would erase it.
      </p>
      <div className="row gap wrap">
        {onOpenCloud && (
          <button className="btn primary" onClick={onOpenCloud}>
            Turn on cloud backup
          </button>
        )}
        <button className={`btn ${onOpenCloud ? '' : 'primary'}`} onClick={() => downloadBackup(data)}>
          Download backup
        </button>
        <button className="btn ghost" onClick={() => store.updateMeta({ backupReminderDismissedAt: Date.now() })}>
          Later
        </button>
      </div>
    </section>
  )
}

function CopyMealSheet({ from, slot, onClose }: { from: DateKey; slot: MealSlot | null; onClose: () => void }) {
  return (
    <Sheet open={slot !== null} onClose={onClose} title={slot ? `Copy ${SLOT_LABELS[slot]}` : 'Copy meal'}>
      {slot && <CopyMealBody key={`${from}-${slot}`} from={from} slot={slot} onClose={onClose} />}
    </Sheet>
  )
}

function CopyMealBody({ from, slot, onClose }: { from: DateKey; slot: MealSlot; onClose: () => void }) {
  const t = today()
  const [to, setTo] = useState<DateKey>(from === t ? addDays(t, 1) : t)
  const [toSlot, setToSlot] = useState<MealSlot>(slot)
  const quick = [
    { label: 'Today', d: t },
    { label: 'Tomorrow', d: addDays(t, 1) },
  ].filter((q) => !(q.d === from && toSlot === slot))
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (to === from && toSlot === slot) return
        const copies = store.copyEntries(from, to, slot, toSlot)
        onClose()
        toast(`Copied ${copies.length} item${copies.length === 1 ? '' : 's'} to ${SLOT_LABELS[toSlot]}, ${formatDayLabel(to).toLowerCase()}`, {
          label: 'Undo',
          run: () => store.deleteEntries(copies.map((c) => c.id)),
        })
      }}
    >
      <div className="row gap wrap">
        {quick.map((q) => (
          <button type="button" key={q.label} className={`chip ${to === q.d ? 'active' : ''}`} onClick={() => setTo(q.d)}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Date</span>
          <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <label className="field">
          <span>Meal</span>
          <select value={toSlot} onChange={(e) => setToSlot(e.target.value as MealSlot)}>
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {SLOT_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn primary" disabled={to === from && toSlot === slot}>
        Copy to {formatDayLabel(to).toLowerCase()}
      </button>
    </form>
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
