import AxeBuilder from '@axe-core/playwright'
import { day, entry, expect, seed, seedData, test } from './fixtures'

const entries = [
  ...Array.from({ length: 14 }, (_, i) => entry(day(-i), 'lunch', 'Chicken rice', 600)),
  entry(day(), 'breakfast', 'Kopi C', 120),
]
const weighIns = Array.from({ length: 21 }, (_, i) => ({ date: day(-20 + i), weightKg: 80 - i * 0.07 }))
const data = seedData({
  entries,
  weighIns,
  settings: {
    weightUnit: 'kg',
    waterUnit: 'ml',
    goals: { calories: 1800, protein: 140, carbs: 180, fat: 60, waterMl: 2500 },
    profile: { sex: 'male', age: 30, heightCm: 175, activity: 'light', goal: 'lose', ratePerWeekKg: 0.5, goalWeightKg: 75 },
  },
})

async function check(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? ''}]`).join('; ')}`)
  expect(summary, summary.join('\n')).toEqual([])
}

for (const [tab, colorScheme] of [
  ['Today', 'light'],
  ['Progress', 'light'],
  ['Weight', 'light'],
  ['Settings', 'light'],
  ['Today', 'dark'],
  ['Progress', 'dark'],
] as const) {
  test(`${tab} screen (${colorScheme}) has no WCAG AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await seed(page, data)
    await page.goto('./')
    await page.locator('nav.tabbar').getByRole('button', { name: tab }).click()
    await page.waitForTimeout(300) // lazy chart chunks + fade-in animation
    await check(page)
  })
}

test('add food sheet has no WCAG AA violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, data)
  await page.goto('./')
  await page.getByRole('button', { name: /Log food/ }).click()
  await page.waitForTimeout(300)
  await check(page)
})

test('progress shows the adaptive maintenance estimate', async ({ page }) => {
  await seed(page, data)
  await page.goto('./')
  await page.locator('nav.tabbar').getByRole('button', { name: 'Progress' }).click()
  await expect(page.getByRole('heading', { name: 'Your real maintenance' })).toBeVisible()
  await expect(page.getByText(/puts your maintenance at about/)).toBeVisible()
})
