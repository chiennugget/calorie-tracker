import { kgToLb, lbToKg, ML_PER_OZ } from './nutrition'
import type { Settings } from './types'

export function displayWeight(kg: number, unit: Settings['weightUnit']): number {
  return Math.round((unit === 'lb' ? kgToLb(kg) : kg) * 10) / 10
}

export function inputWeightToKg(value: number, unit: Settings['weightUnit']): number {
  return unit === 'lb' ? lbToKg(value) : value
}

export function displayWater(ml: number, unit: Settings['waterUnit']): string {
  return unit === 'oz' ? `${Math.round(ml / ML_PER_OZ)} oz` : ml >= 1000 ? `${(ml / 1000).toFixed(2)} L` : `${Math.round(ml)} ml`
}

export function waterIncrements(unit: Settings['waterUnit']): { label: string; ml: number }[] {
  return unit === 'oz'
    ? [
        { label: '+8 oz', ml: 8 * ML_PER_OZ },
        { label: '+16 oz', ml: 16 * ML_PER_OZ },
        { label: '+24 oz', ml: 24 * ML_PER_OZ },
      ]
    : [
        { label: '+250 ml', ml: 250 },
        { label: '+500 ml', ml: 500 },
        { label: '+750 ml', ml: 750 },
      ]
}
