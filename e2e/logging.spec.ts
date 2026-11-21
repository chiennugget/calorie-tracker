import { day, entry, expect, readData, seed, seedData, test } from './fixtures'

test('quick add a meal, then edit and delete it with undo', async ({ page }) => {
  await seed(page, seedData())
  await page.goto('./')
  await page.locator('.meal-card.dinner').getByRole('button', { name: 'Add' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('tab', { name: 'Quick add' }).or(sheet.getByRole('button', { name: 'Quick add' })).first().click()
  await sheet.getByLabel('Name').fill('Nasi lemak')
  await sheet.getByLabel('Calories').fill('650')
  await sheet.getByRole('button', { name: 'Add to diary' }).click()
  await expect(sheet).toBeHidden()

  const dinner = page.locator('.meal-card.dinner')
  await expect(dinner.getByText('Nasi lemak')).toBeVisible()
  await expect(page.locator('.hero-number')).toHaveText('1,350')

  await dinner.getByText('Nasi lemak').click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(dinner.getByText('Nasi lemak')).toBeHidden()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(dinner.getByText('Nasi lemak')).toBeVisible()
})

test('hawker search: typo-tolerant, with portion adjustment', async ({ page }) => {
  await seed(page, seedData())
  await page.goto('./')
  await page.getByRole('button', { name: /Log food/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('searchbox').fill('chiken rice')
  await sheet.getByRole('button', { name: /Chicken rice/i }).first().click()
  await sheet.getByRole('tab', { name: 'Large' }).or(sheet.getByRole('button', { name: 'Large', exact: true })).first().click()
  await sheet.getByRole('button', { name: 'Add to diary' }).click()
  await expect(page.getByRole('status')).toContainText(/Added .*chicken rice/i)
  const data = await readData(page)
  expect(data.entries).toHaveLength(1)
  expect(data.entries[0].name).toMatch(/large/i)
})

test('packaged food search shows a friendly error when Open Food Facts is down', async ({ page }) => {
  await seed(page, seedData())
  await page.route('https://world.openfoodfacts.org/**', (r) => r.abort())
  await page.goto('./')
  await page.getByRole('button', { name: /Log food/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('searchbox').fill('oat milk')
  await sheet.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(sheet.getByText(/isn't responding/)).toBeVisible({ timeout: 15_000 })
})

test('recent tab: usual foods and re-logging a whole meal', async ({ page }) => {
  const entries = [
    entry(day(-3), 'breakfast', 'Kaya toast set', 380),
    entry(day(-2), 'breakfast', 'Kaya toast set', 380),
    entry(day(-1), 'breakfast', 'Kaya toast set', 380),
    entry(day(-1), 'breakfast', 'Kopi C', 120),
  ]
  await seed(page, seedData({ entries }))
  await page.goto('./')
  await page.locator('.meal-card.breakfast').getByRole('button', { name: 'Add' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Your usual breakfast' })).toBeVisible()
  await expect(sheet.getByText('3× at breakfast')).toBeVisible()
  await sheet.getByRole('button', { name: /Add all 2 items/ }).click()
  await expect(page.getByRole('status')).toContainText('Added 2 items to Breakfast')
  await page.keyboard.press('Escape')
  const breakfast = page.locator('.meal-card.breakfast')
  await expect(breakfast.getByText('Kopi C')).toBeVisible()
  await expect(breakfast.getByText('Kaya toast set')).toBeVisible()
})

test('copy a meal to tomorrow, then undo', async ({ page }) => {
  await seed(page, seedData({ entries: [entry(day(), 'lunch', 'Fish soup', 400), entry(day(), 'lunch', 'Barley', 90)] }))
  await page.goto('./')
  await page.getByRole('button', { name: 'Copy Lunch to another day' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Meal').selectOption('dinner')
  await sheet.getByRole('button', { name: 'Copy to tomorrow' }).click()
  await expect(page.getByRole('status')).toContainText('Copied 2 items to Dinner, tomorrow')
  let data = await readData(page)
  expect(data.entries.filter((e: { date: string; slot: string }) => e.date === day(1) && e.slot === 'dinner')).toHaveLength(2)
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (data = await readData(page)).entries.length).toBe(2)
})

test('weekly budget card reflects the week so far', async ({ page }) => {
  await seed(page, seedData({ entries: [entry(day(), 'lunch', 'Big lunch', 2500)] }))
  await page.goto('./')
  const week = page.getByRole('region', { name: 'This week' })
  await expect(week).toBeVisible()
  await expect(week.getByRole('progressbar', { name: 'Weekly calories' })).toBeVisible()
})
