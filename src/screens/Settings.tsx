import { useRef, useState } from 'react'
import { MealForm } from '../components/MealForm'
import { toast } from '../components/toast'
import { NumberField, Segmented, Sheet, kcal, toNum } from '../components/ui'
import { today } from '../lib/date'
import { ACTIVITY_LABELS, bmr, caloriesFromMacros, sortedWeighIns, suggestGoals, tdee } from '../lib/nutrition'
import { diaryToCsv, parseData, serialiseData, weighInsToCsv } from '../lib/storage'
import { displayWeight, inputWeightToKg } from '../lib/units'
import { store } from '../lib/useStore'
import type { ActivityLevel, AppData, Goals, Profile, SavedMeal, Sex, WeightGoal } from '../lib/types'

export type SettingsPage = 'goals' | 'calculator' | 'meals' | 'units' | 'data'

const PAGES: { id: SettingsPage; icon: string; title: string; sub: (d: AppData) => string }[] = [
  { id: 'goals', icon: '🎯', title: 'Daily goals', sub: (d) => `${d.settings.goals.calories.toLocaleString()} kcal · P ${d.settings.goals.protein} · C ${d.settings.goals.carbs} · F ${d.settings.goals.fat}` },
  { id: 'calculator', icon: '🧮', title: 'Goal calculator', sub: () => 'Work out your calories and macros' },
  { id: 'meals', icon: '⭐', title: 'My meals', sub: (d) => `${d.savedMeals.length} saved` },
  { id: 'units', icon: '📏', title: 'Units', sub: (d) => (d.settings.weightUnit === 'lb' ? 'Imperial (lb, fl oz)' : 'Metric (kg, ml)') },
  { id: 'data', icon: '💾', title: 'Backup & export', sub: (d) => `${d.entries.length} diary ${d.entries.length === 1 ? 'entry' : 'entries'}` },
]

export function Settings({ data, page, onOpen }: { data: AppData; page: SettingsPage | null; onOpen: (p: SettingsPage) => void }) {
  if (page) {
    const meta = PAGES.find((p) => p.id === page)!
    return (
      <div className="screen slide-in">
        <h2 className="subpage-title">{meta.title}</h2>
        {page === 'goals' && <GoalsCard data={data} />}
        {page === 'calculator' && <CalculatorCard data={data} />}
        {page === 'meals' && <MealsCard meals={data.savedMeals} />}
        {page === 'units' && <UnitsCard data={data} />}
        {page === 'data' && <DataCard data={data} />}
      </div>
    )
  }

  return (
    <div className="screen">
      <ul className="card menu">
        {PAGES.map((p, i) => (
          <li key={p.id} style={{ animationDelay: `${i * 30}ms` }}>
            <button onClick={() => onOpen(p.id)}>
              <span className="menu-icon" aria-hidden>
                {p.icon}
              </span>
              <span className="grow">
                <span className="item-name">{p.title}</span>
                <span className="muted small">{p.sub(data)}</span>
              </span>
              <span className="chev" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoalsCard({ data }: { data: AppData }) {
  const g = data.settings.goals
  const [v, setV] = useState({
    calories: String(g.calories),
    protein: String(g.protein),
    carbs: String(g.carbs),
    fat: String(g.fat),
    water: String(Math.round(data.settings.waterUnit === 'oz' ? g.waterMl / 29.5735 : g.waterMl)),
  })
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x })
  const macroKcal = caloriesFromMacros({ protein: toNum(v.protein), carbs: toNum(v.carbs), fat: toNum(v.fat) })
  return (
    <section className="card">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          const goals: Goals = {
            calories: Math.round(toNum(v.calories)),
            protein: toNum(v.protein),
            carbs: toNum(v.carbs),
            fat: toNum(v.fat),
            waterMl: data.settings.waterUnit === 'oz' ? toNum(v.water) * 29.5735 : toNum(v.water),
          }
          store.updateSettings({ goals })
          toast('Goals saved')
        }}
      >
        <div className="grid-2">
          <NumberField label="Calories" value={v.calories} onChange={set('calories')} suffix="kcal" step="10" />
          <NumberField label="Water" value={v.water} onChange={set('water')} suffix={data.settings.waterUnit} step="1" />
          <NumberField label="Protein" value={v.protein} onChange={set('protein')} suffix="g" step="1" />
          <NumberField label="Carbs" value={v.carbs} onChange={set('carbs')} suffix="g" step="1" />
          <NumberField label="Fat" value={v.fat} onChange={set('fat')} suffix="g" step="1" />
        </div>
        {Math.abs(macroKcal - toNum(v.calories)) > 50 && (
          <p className="hint warn">
            Macro goals add up to {kcal(macroKcal)} kcal.{' '}
            <button type="button" className="link" onClick={() => set('calories')(String(macroKcal))}>
              Use {kcal(macroKcal)}
            </button>
          </p>
        )}
        <button className="btn primary">Save goals</button>
      </form>
    </section>
  )
}

function CalculatorCard({ data }: { data: AppData }) {
  const unit = data.settings.weightUnit
  const p = data.settings.profile
  const latest = sortedWeighIns(data.weighIns).at(-1)
  const [sex, setSex] = useState<Sex>(p?.sex ?? 'male')
  const [age, setAge] = useState(String(p?.age ?? ''))
  const imperial = unit === 'lb'
  const [height, setHeight] = useState(p?.heightCm ? String(p.heightCm) : '')
  const [feet, setFeet] = useState(p?.heightCm ? String(Math.floor(p.heightCm / 2.54 / 12)) : '')
  const [inches, setInches] = useState(p?.heightCm ? String(Math.round((p.heightCm / 2.54) % 12)) : '')
  const [weight, setWeight] = useState(latest ? String(displayWeight(latest.weightKg, unit)) : '')
  const [activity, setActivity] = useState<ActivityLevel>(p?.activity ?? 'light')
  const [goal, setGoal] = useState<WeightGoal>(p?.goal ?? 'lose')
  const [rate, setRate] = useState(String(p ? displayWeight(p.ratePerWeekKg, unit) : unit === 'lb' ? 1 : 0.5))
  const [goalWeight, setGoalWeight] = useState(p?.goalWeightKg ? String(displayWeight(p.goalWeightKg, unit)) : '')

  const weightKg = inputWeightToKg(toNum(weight), unit)
  const profile: Profile = {
    sex,
    age: toNum(age),
    heightCm: imperial ? Math.round((toNum(feet) * 12 + toNum(inches)) * 2.54) : toNum(height),
    activity,
    goal,
    ratePerWeekKg: goal === 'maintain' ? 0 : inputWeightToKg(toNum(rate), unit),
    goalWeightKg: toNum(goalWeight) ? inputWeightToKg(toNum(goalWeight), unit) : undefined,
  }
  const ready = profile.age > 0 && profile.heightCm > 0 && weightKg > 0
  const suggested = ready ? suggestGoals(profile, weightKg, data.settings.goals.waterMl) : null

  return (
    <section className="card">
      <p className="muted small">Estimates your maintenance calories (Mifflin–St Jeor) and suggests targets.</p>
      <div className="stack">
        <div className="field">
          <span>Sex</span>
          <Segmented
            value={sex}
            onChange={setSex}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
          />
        </div>
        {imperial ? (
          <>
            <div className="grid-2">
              <NumberField label="Age" value={age} onChange={setAge} step="1" suffix="yrs" />
              <NumberField label="Weight" value={weight} onChange={setWeight} suffix="lb" step="0.1" />
            </div>
            <div className="grid-2">
              <NumberField label="Height" value={feet} onChange={setFeet} suffix="ft" step="1" />
              <NumberField label={'\u00a0'} value={inches} onChange={setInches} suffix="in" step="1" />
            </div>
          </>
        ) : (
          <div className="grid-3">
            <NumberField label="Age" value={age} onChange={setAge} step="1" suffix="yrs" />
            <NumberField label="Height" value={height} onChange={setHeight} suffix="cm" step="1" />
            <NumberField label="Weight" value={weight} onChange={setWeight} suffix="kg" step="0.1" />
          </div>
        )}
        <label className="field">
          <span>Activity level</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {Object.entries(ACTIVITY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Goal</span>
          <Segmented
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
          />
        </div>
        {goal !== 'maintain' && (
          <div className="grid-2">
            <NumberField label="Rate per week" value={rate} onChange={setRate} suffix={unit} step="0.1" />
            <NumberField label="Goal weight" value={goalWeight} onChange={setGoalWeight} suffix={unit} step="0.1" />
          </div>
        )}
        {suggested && (
          <div className="card tight">
            <p className="small">
              BMR {kcal(bmr(profile, weightKg))} · Maintenance ≈ <b>{kcal(tdee(profile, weightKg))} kcal</b>
            </p>
            <p>
              Suggested: <b>{kcal(suggested.calories)} kcal</b> · P {suggested.protein} g · C {suggested.carbs} g · F {suggested.fat} g
            </p>
          </div>
        )}
        <button
          className="btn primary"
          disabled={!suggested}
          onClick={() => {
            if (!suggested) return
            store.updateSettings({ profile, goals: suggested })
            if (!data.weighIns.some((w) => w.date === today())) store.logWeight({ date: today(), weightKg })
            toast('Goals updated from calculator')
          }}
        >
          Apply suggested goals
        </button>
      </div>
    </section>
  )
}

function MealsCard({ meals }: { meals: SavedMeal[] }) {
  const [editing, setEditing] = useState<SavedMeal | 'new' | null>(null)
  return (
    <section className="card">
      <button className="btn primary" onClick={() => setEditing('new')}>
        + New meal
      </button>
      {meals.length === 0 && <p className="muted small">Save meals you eat often so you can add them in one tap.</p>}
      <ul className="list">
        {[...meals]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => (
            <li key={m.id} className="list-item">
              <button className="plain text-left full row between" onClick={() => setEditing(m)}>
                <div>
                  <div className="item-name">{m.name}</div>
                  <div className="muted small">
                    P {m.nutrients.protein} · C {m.nutrients.carbs} · F {m.nutrients.fat}
                    {m.useCount ? ` · used ${m.useCount}×` : ''}
                  </div>
                </div>
                <span className="kcal">{kcal(m.nutrients.calories)}</span>
              </button>
            </li>
          ))}
      </ul>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New meal' : 'Edit meal'}>
        {editing !== null && (
          <div className="stack">
            <MealForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : { ...editing, servings: 1 }}
              submitLabel={editing === 'new' ? 'Save meal' : 'Save changes'}
              showServings={false}
              onSubmit={(v) => {
                if (editing === 'new') store.saveMeal({ name: v.name, nutrients: v.nutrients })
                else store.updateSavedMeal(editing.id, { name: v.name, nutrients: v.nutrients })
                setEditing(null)
              }}
            />
            {editing !== 'new' && (
              <button
                className="btn danger"
                onClick={() => {
                  const m = editing
                  store.deleteSavedMeal(m.id)
                  setEditing(null)
                  toast(`Deleted ${m.name}`, { label: 'Undo', run: () => store.restoreSavedMeal(m) })
                }}
              >
                Delete meal
              </button>
            )}
          </div>
        )}
      </Sheet>
    </section>
  )
}

function UnitsCard({ data }: { data: AppData }) {
  const system = data.settings.weightUnit === 'lb' ? 'imperial' : 'metric'
  return (
    <section className="card">
      <Segmented
        value={system}
        onChange={(v) =>
          store.updateSettings(v === 'imperial' ? { weightUnit: 'lb', waterUnit: 'oz' } : { weightUnit: 'kg', waterUnit: 'ml' })
        }
        options={[
          { value: 'metric', label: 'Metric' },
          { value: 'imperial', label: 'Imperial' },
        ]}
      />
      <p className="muted small">
        {system === 'metric'
          ? 'Weight in kilograms, height in centimetres, water in millilitres.'
          : 'Weight in pounds, height in feet and inches, water in fluid ounces.'}
      </p>
    </section>
  )
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DataCard({ data }: { data: AppData }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const stamp = today()
  return (
    <section className="card">
      <p className="muted small">
        {data.entries.length} diary entries · {data.savedMeals.length} saved meals · {data.weighIns.length} weigh-ins. Back up regularly
        — clearing browser data deletes it.
      </p>
      <div className="row gap wrap">
        <button className="btn" onClick={() => download(`calorie-tracker-backup-${stamp}.json`, serialiseData(data), 'application/json')}>
          Export backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <button className="btn ghost" onClick={() => download(`food-diary-${stamp}.csv`, diaryToCsv(data), 'text/csv')}>
          Diary CSV
        </button>
        <button className="btn ghost" onClick={() => download(`weigh-ins-${stamp}.csv`, weighInsToCsv(data), 'text/csv')}>
          Weight CSV
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            const parsed = parseData(await file.text())
            if (confirm(`Replace all current data with this backup (${parsed.entries.length} entries)?`)) {
              store.replaceAll(parsed)
              toast('Backup restored')
            }
          } catch {
            alert('That file is not a valid Calorie Tracker backup.')
          }
        }}
      />
      <button
        className="btn danger ghost"
        style={{ marginTop: 12 }}
        onClick={() => {
          if (confirm('Delete ALL data on this device? This cannot be undone. Export a backup first!')) store.reset()
        }}
      >
        Reset all data
      </button>
    </section>
  )
}
