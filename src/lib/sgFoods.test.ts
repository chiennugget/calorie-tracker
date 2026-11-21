import { describe, expect, it } from 'vitest'
import { SG_ADDONS, SG_DISHES, SG_DISH_BY_ID, computeDish, describeDish, searchSgDishes } from './sgFoods'

describe('sg hawker database', () => {
  it('has unique ids, valid add-ons and sane macros', () => {
    expect(new Set(SG_DISHES.map((d) => d.id)).size).toBe(SG_DISHES.length)
    for (const d of SG_DISHES) {
      for (const a of d.addOns ?? []) expect(SG_ADDONS[a], `${d.id} → ${a}`).toBeDefined()
      const fromMacros = d.n.protein * 4 + d.n.carbs * 4 + d.n.fat * 9
      // Macros should roughly explain the calories (within 25% or 40 kcal)
      expect(Math.abs(fromMacros - d.n.calories), d.id).toBeLessThan(Math.max(40, d.n.calories * 0.25))
    }
  })

  it('adjusts for oil, portion and add-ons', () => {
    const ckt = SG_DISH_BY_ID.char_kway_teow
    const base = computeDish(ckt, { portion: 'regular', oil: 'normal', addOns: {} })
    expect(base.calories).toBe(744)
    const oily = computeDish(ckt, { portion: 'regular', oil: 'extra', addOns: {} })
    expect(oily.calories - base.calories).toBe(Math.round(25 * 0.6 * 9))
    const less = computeDish(ckt, { portion: 'regular', oil: 'less', addOns: {} })
    expect(less.fat).toBeLessThan(base.fat)
    const large = computeDish(ckt, { portion: 'large', oil: 'normal', addOns: { cockles: 1 } })
    expect(large.calories).toBe(Math.round(744 * 1.3 + 35))
    expect(describeDish(ckt, { portion: 'large', oil: 'extra', addOns: { cockles: 1 } })).toBe('Char kway teow (large, extra oily, + cockles)')
  })

  it('removing chicken skin lowers fat', () => {
    const cr = SG_DISH_BY_ID.chicken_rice_steamed
    expect(computeDish(cr, { portion: 'regular', oil: 'normal', addOns: { skin_off: 1 } }).fat).toBeLessThan(cr.n.fat)
  })

  it('finds dishes by name and alias', () => {
    expect(searchSgDishes('ckt')[0].id).toBe('char_kway_teow')
    expect(searchSgDishes('chicken rice')[0].id).toMatch(/chicken_rice/)
    expect(searchSgDishes('cai png')[0].id).toBe('economy_rice')
    expect(searchSgDishes('prata').length).toBeGreaterThanOrEqual(2)
    expect(searchSgDishes('zzzz')).toEqual([])
  })
})
