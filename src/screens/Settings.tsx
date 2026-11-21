import { useRef, useState } from 'react'
import { MealForm } from '../components/MealForm'
import { toast } from '../components/toast'
import { NumberField, Sheet, kcal, toNum } from '../components/ui'
import { today } from '../lib/date'
import { ACTIVITY_LABELS, bmr, caloriesFromMacros, sortedWeighIns, suggestGoals, tdee } from '../lib/nutrition'
import { diaryToCsv, parseData, serialiseData, weighInsToCsv } from '../lib/storage'
import { displayWeight, inputWeightToKg } from '../lib/units'
import { store } from '../lib/useStore'
import type { ActivityLevel, AppData, Goals, Profile, SavedMeal, Sex, WeightGoal } from '../lib/types'

export function Settings({ data }: { data: AppData }) {
  return (
    <div className="screen">
      <GoalsCard data={data} />
      <CalculatorCard data={data} />
      <MealsCard meals={data.savedMeals} />
      <PreferencesCard data={data} />
      <DataCard data={data} />
      <p className="muted small center-text">
        All data is stored on this device only. No account, no ads, no paywall.
      </p>
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
      <h3>Daily goals</h3>
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
  const [height, setHeight] = useState(String(p?.heightCm ?? ''))
  const [weight, setWeight] = useState(latest ? String(displayWeight(latest.weightKg, unit)) : '')
  const [activity, setActivity] = useState<ActivityLevel>(p?.activity ?? 'light')
  const [goal, setGoal] = useState<WeightGoal>(p?.goal ?? 'lose')
  const [rate, setRate] = useState(String(p ? displayWeight(p.ratePerWeekKg, unit) : unit === 'lb' ? 1 : 0.5))
  const [goalWeight, setGoalWeight] = useState(p?.goalWeightKg ? String(displayWeight(p.goalWeightKg, unit)) : '')

  const weightKg = inputWeightToKg(toNum(weight), unit)
  const profile: Profile = {
    sex,
    age: toNum(age),
    heightCm: toNum(height),
    activity,
    goal,
    ratePerWeekKg: goal === 'maintain' ? 0 : inputWeightToKg(toNum(rate), unit),
    goalWeightKg: toNum(goalWeight) ? inputWeightToKg(toNum(goalWeight), unit) : undefined,
  }
  const ready = profile.age > 0 && profile.heightCm > 0 && weightKg > 0
  const suggested = ready ? suggestGoals(profile, weightKg, data.settings.goals.waterMl) : null

  return (
    <section className="card">
      <h3>Goal calculator</h3>
      <p className="muted small">Estimates your maintenance calories (Mifflin–St Jeor) and suggests targets.</p>
      <div className="stack">
        <div className="grid-2">
          <label className="field">
            <span>Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <NumberField label="Age" value={age} onChange={setAge} step="1" />
          <NumberField label="Height" value={height} onChange={setHeight} suffix="cm" step="1" />
          <NumberField label="Weight" value={weight} onChange={setWeight} suffix={unit} step="0.1" />
        </div>
        <label className="field">
          <span>Activity</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {Object.entries(ACTIVITY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value as WeightGoal)}>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select>
          </label>
          {goal !== 'maintain' && <NumberField label="Rate per week" value={rate} onChange={setRate} suffix={unit} step="0.1" />}
          <NumberField label="Goal weight (optional)" value={goalWeight} onChange={setGoalWeight} suffix={unit} step="0.1" />
        </div>
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
      <header className="row between">
        <h3>My meals ({meals.length})</h3>
        <button className="link" onClick={() => setEditing('new')}>
          + New meal
        </button>
      </header>
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

function PreferencesCard({ data }: { data: AppData }) {
  const s = data.settings
  return (
    <section className="card">
      <h3>Preferences</h3>
      <div className="stack">
        <div className="grid-2">
          <label className="field">
            <span>Weight unit</span>
            <select value={s.weightUnit} onChange={(e) => store.updateSettings({ weightUnit: e.target.value as 'kg' | 'lb' })}>
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </label>
          <label className="field">
            <span>Water unit</span>
            <select value={s.waterUnit} onChange={(e) => store.updateSettings({ waterUnit: e.target.value as 'ml' | 'oz' })}>
              <option value="ml">Millilitres (ml)</option>
              <option value="oz">Fluid ounces (oz)</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.addExerciseToBudget} onChange={(e) => store.updateSettings({ addExerciseToBudget: e.target.checked })} />
          Add exercise calories to my daily budget
        </label>
      </div>
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
      <h3>Your data</h3>
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
