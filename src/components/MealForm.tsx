import { useState } from 'react'
import { caloriesFromMacros } from '../lib/nutrition'
import type { Nutrients } from '../lib/types'
import { NumberField, toNum } from './ui'

export interface MealFormValue {
  name: string
  nutrients: Nutrients
  servings: number
  servingLabel?: string
  saveToMeals: boolean
}

const str = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(n))

/** Used for quick add, editing diary entries, and creating/editing saved meals. */
export function MealForm({
  initial,
  submitLabel,
  showServings = true,
  showSaveToggle = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<MealFormValue>
  submitLabel: string
  showServings?: boolean
  showSaveToggle?: boolean
  onSubmit: (v: MealFormValue) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [calories, setCalories] = useState(str(initial?.nutrients?.calories))
  const [protein, setProtein] = useState(str(initial?.nutrients?.protein))
  const [carbs, setCarbs] = useState(str(initial?.nutrients?.carbs))
  const [fat, setFat] = useState(str(initial?.nutrients?.fat))
  const [servings, setServings] = useState(String(initial?.servings ?? 1))
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? '')
  const [saveToMeals, setSaveToMeals] = useState(initial?.saveToMeals ?? false)

  const macroKcal = caloriesFromMacros({ protein: toNum(protein), carbs: toNum(carbs), fat: toNum(fat) })
  const effectiveCalories = calories === '' ? macroKcal : toNum(calories)
  const valid = effectiveCalories > 0 || macroKcal > 0
  const mismatch = calories !== '' && macroKcal > 0 && Math.abs(macroKcal - toNum(calories)) > Math.max(25, toNum(calories) * 0.15)

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          name: name.trim() || 'Quick add',
          nutrients: {
            calories: Math.round(effectiveCalories),
            protein: toNum(protein),
            carbs: toNum(carbs),
            fat: toNum(fat),
          },
          servings: Math.max(0.01, toNum(servings) || 1),
          servingLabel: servingLabel.trim() || undefined,
          saveToMeals,
        })
      }}
    >
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mum's lasagne"
          autoFocus={!initial?.name}
          enterKeyHint="next"
        />
      </label>
      <div className="grid-2">
        <NumberField label="Calories" value={calories} onChange={setCalories} suffix="kcal" step="1" />
        <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
        <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
      </div>
      {calories === '' && macroKcal > 0 && <p className="hint">Calories will be calculated from macros: {macroKcal} kcal</p>}
      {mismatch && (
        <p className="hint warn">
          Heads up: these macros add up to {macroKcal} kcal.{' '}
          <button type="button" className="link" onClick={() => setCalories(String(macroKcal))}>
            Use {macroKcal}
          </button>
        </p>
      )}
      {showServings && (
        <div className="grid-2">
          <NumberField label="Servings" value={servings} onChange={setServings} step="0.25" />
          <label className="field">
            <span>Serving size (optional)</span>
            <input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="1 plate" />
          </label>
        </div>
      )}
      {showSaveToggle && (
        <label className="check">
          <input type="checkbox" checked={saveToMeals} onChange={(e) => setSaveToMeals(e.target.checked)} />
          Save to My Meals
        </label>
      )}
      <div className="row gap">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn primary grow" disabled={!valid}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
