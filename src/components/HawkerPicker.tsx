import { useState } from 'react'
import {
  DEFAULT_OPTIONS,
  OIL_LABELS,
  PORTION_LABELS,
  SG_ADDONS,
  computeDish,
  describeDish,
  type DishOptions,
  type OilLevel,
  type Portion,
  type SgDish,
} from '../lib/sgFoods'
import { scaleNutrients } from '../lib/nutrition'
import type { PickedFood } from './FoodPicker'
import { MacroLine, NumberField, Segmented, kcal, toNum } from './ui'

/** Portion / oil / add-on controls shared by the hawker picker and the AI review. */
export function DishOptionsEditor({ dish, value, onChange }: { dish: SgDish; value: DishOptions; onChange: (o: DishOptions) => void }) {
  const setAddOn = (id: string, delta: number) => {
    const next = Math.max(0, (value.addOns[id] ?? 0) + delta)
    const addOns = { ...value.addOns, [id]: next }
    if (!next) delete addOns[id]
    onChange({ ...value, addOns })
  }
  return (
    <div className="stack">
      <div className="field">
        <span>Portion</span>
        <Segmented
          value={value.portion}
          onChange={(portion: Portion) => onChange({ ...value, portion })}
          options={(Object.keys(PORTION_LABELS) as Portion[]).map((p) => ({ value: p, label: PORTION_LABELS[p] }))}
        />
      </div>
      {dish.oilG > 0 && (
        <div className="field">
          <span>Oil level</span>
          <Segmented
            value={value.oil}
            onChange={(oil: OilLevel) => onChange({ ...value, oil })}
            options={(Object.keys(OIL_LABELS) as OilLevel[]).map((o) => ({ value: o, label: OIL_LABELS[o] }))}
          />
        </div>
      )}
      {dish.addOns && dish.addOns.length > 0 && (
        <div className="field">
          <span>Add-ons</span>
          <ul className="addons">
            {dish.addOns.map((id) => {
              const a = SG_ADDONS[id]
              const count = value.addOns[id] ?? 0
              return (
                <li key={id} className={count ? 'on' : ''}>
                  <span className="grow">
                    {a.name}
                    <span className="muted small"> {a.n.calories > 0 ? '+' : ''}{a.n.calories} kcal</span>
                  </span>
                  {count > 0 && (
                    <button type="button" className="step" aria-label={`Remove ${a.name}`} onClick={() => setAddOn(id, -1)}>
                      −
                    </button>
                  )}
                  {count > 0 && <b className="count">{count}</b>}
                  <button type="button" className="step" aria-label={`Add ${a.name}`} onClick={() => setAddOn(id, 1)}>
                    +
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function HawkerPicker({ dish, onAdd, onBack }: { dish: SgDish; onAdd: (f: PickedFood) => void; onBack: () => void }) {
  const [opts, setOpts] = useState<DishOptions>(DEFAULT_OPTIONS)
  const [qty, setQty] = useState('1')
  const [save, setSave] = useState(false)
  const per = computeDish(dish, opts)
  const total = scaleNutrients(per, toNum(qty))

  return (
    <div className="stack">
      <button className="link back" onClick={onBack}>
        ‹ Back
      </button>
      <div>
        <h3 className="food-title">{dish.name}</h3>
        <p className="muted small">
          Typical {dish.serving}: {kcal(dish.n.calories)} kcal · Singapore hawker estimate
        </p>
      </div>
      <DishOptionsEditor dish={dish} value={opts} onChange={setOpts} />
      <NumberField label={dish.countable ? `Quantity (${dish.serving})` : 'Servings'} value={qty} onChange={setQty} step="0.5" />
      <div className="card tight center">
        <div className="big">{kcal(total.calories)} kcal</div>
        <MacroLine n={total} />
      </div>
      <label className="check">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        Save to My Meals
      </label>
      <button
        className="btn primary"
        disabled={toNum(qty) <= 0}
        onClick={() =>
          onAdd({ name: describeDish(dish, opts), nutrients: per, servings: toNum(qty), servingLabel: dish.serving, saveToMeals: save })
        }
      >
        Add to diary
      </button>
      <p className="muted small">Hawker plates vary a lot between stalls — these are typical estimates, not lab values.</p>
    </div>
  )
}
