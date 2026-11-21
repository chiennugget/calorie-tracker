import { day, entry, expect, readData, seed, seedData, test } from './fixtures'

test('first run: welcome card, defaults, and data survives a reload', async ({ page }) => {
  await seed(page, null)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()
  const welcome = page.getByRole('heading', { name: /Welcome/ })
  await expect(welcome).toBeVisible()
  await page.getByRole('button', { name: 'Use defaults' }).click()
  await expect(welcome).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()
  await expect(welcome).toBeHidden()
  expect((await readData(page)).meta.onboarded).toBe(true)
})

test('welcome card leads to the goal calculator', async ({ page }) => {
  await seed(page, null)
  await page.goto('./')
  await page.getByRole('button', { name: 'Set my goals' }).click()
  await expect(page.getByRole('heading', { name: 'Goal calculator' })).toBeVisible()
  // Phone back gesture returns to the Settings menu.
  await page.goBack()
  await expect(page.getByRole('button', { name: /Daily goals/ })).toBeVisible()
})

test('migrates v1 data from an older version of the app', async ({ page }) => {
  const v1 = seedData({ version: 1, entries: [entry(day(), 'lunch', 'Laksa', 600)] })
  delete v1.meta
  await seed(page, v1)
  await page.goto('./')
  await expect(page.getByText('Laksa')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeHidden()
  // Any write persists the migrated shape.
  await page.getByRole('button', { name: '+250 ml' }).click()
  const saved = await readData(page)
  expect(saved.version).toBe(2)
  expect(saved.meta.onboarded).toBe(true)
})
