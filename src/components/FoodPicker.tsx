import { useState } from 'react'
import type { FoodProduct } from '../lib/foodApi'
import { scaleNutrients } from '../lib/nutrition'
import type { Nutrients } from '../lib/types'
import { BackLink, MacroLine, NumberField, Segmented, kcal, toNum } from './ui'

export interface PickedFood {
  name: string
  nutrients: Nutrients
  servings: number
  servingLabel?: string
  barcode?: string
  saveToMeals: boolean
}

/** Choose an amount (grams or servings) of a database product. */
export function FoodPicker({
  product,
  onAdd,
  onBack,
}: {
  product: FoodProduct
  onAdd: (f: PickedFood) => void
  onBack: () => void
}) {
  const [mode, setMode] = useState<'serving' | 'g'>(product.perServing ? 'serving' : 'g')
  const [amount, setAmount] = useState(product.perServing ? '1' : String(product.servingGrams ?? 100))
  const [save, setSave] = useState(false)

  const a = toNum(amount)
  const total =
    mode === 'serving' && product.perServing
      ? scaleNutrients(product.perServing, a)
      : scaleNutrients(product.per100g, a / 100)
  const name = product.brand ? `${product.name} (${product.brand})` : product.name

  return (
    <div className="stack">
      <BackLink label="Back to results" onClick={onBack} />
      <div>
        <h3 className="food-title">{product.name}</h3>
        {product.brand && <p className="muted">{product.brand}</p>}
      </div>
      {product.perServing && (
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setAmount(m === 'serving' ? '1' : String(product.servingGrams ?? 100))
          }}
          options={[
            { value: 'serving', label: `Servings${product.servingSize ? ` (${product.servingSize})` : ''}` },
            { value: 'g', label: 'Grams' },
          ]}
        />
      )}
      <NumberField
        label={mode === 'g' ? 'Amount' : 'Number of servings'}
        value={amount}
        onChange={setAmount}
        suffix={mode === 'g' ? 'g' : '×'}
        step={mode === 'g' ? '1' : '0.25'}
        autoFocus
      />
      <p className="muted small">
        Per 100 g: {kcal(product.per100g.calories)} kcal
        {product.perServing && ` · per serving: ${kcal(product.perServing.calories)} kcal`}
      </p>
      <label className="check">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        Save to My Meals
      </label>
      <p className="muted small">Data from Open Food Facts (community database) — double-check against the label.</p>
      <div className="sticky-cta">
        <div className="grow" aria-live="polite">
          <div className="cta-kcal">{kcal(total.calories)} kcal</div>
          <MacroLine n={total} className="small" />
        </div>
      <button
        className="btn primary"
        disabled={a <= 0}
        onClick={() =>
          onAdd(
            mode === 'serving' && product.perServing
              ? {
                  name,
                  nutrients: product.perServing,
                  servings: a,
                  servingLabel: product.servingSize ?? '1 serving',
                  barcode: product.code,
                  saveToMeals: save,
                }
              : {
                  name,
                  nutrients: total,
                  servings: 1,
                  servingLabel: `${a} g`,
                  barcode: product.code,
                  saveToMeals: save,
                },
          )
        }
      >
        Add to diary
      </button>
      </div>
    </div>
  )
}
