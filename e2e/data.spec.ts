import { expect, entry, day, readData, seed, seedData, test } from './fixtures'

const DAY = 864e5

test('backup reminder downloads a backup and goes away', async ({ page }) => {
  const entries = Array.from({ length: 20 }, (_, i) => entry(day(-i), 'lunch', `Meal ${i}`, 500, { createdAt: Date.now() - 30 * DAY }))
  await seed(page, seedData({ entries, meta: { onboarded: true } }))
  await page.goto('./')
  const reminder = page.getByRole('region', { name: 'Backup reminder' })
  await expect(reminder).toBeVisible()
  const download = page.waitForEvent('download')
  await reminder.getByRole('button', { name: 'Download backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^calorie-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(reminder).toBeHidden()
  expect((await readData(page)).meta.lastBackupAt).toBeGreaterThan(Date.now() - 60_000)
})

test('import rejects a bad file and restores a good one', async ({ page }) => {
  await seed(page, seedData())
  await page.goto('./')
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: /Backup & export/ }).click()

  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') })
  await expect(page.getByRole('status')).toContainText("isn't a valid")

  const good = seedData({ entries: [entry(day(), 'dinner', 'Restored dish', 777)] })
  page.once('dialog', (d) => d.accept())
  await page.locator('input[type=file]').setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) })
  await expect(page.getByRole('status')).toContainText('Backup restored')
  expect((await readData(page)).entries[0].name).toBe('Restored dish')
})

test('warns when storage is full instead of silently losing changes', async ({ page }) => {
  await seed(page, seedData())
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'calorie-tracker:v1') throw new DOMException('full', 'QuotaExceededError')
      return orig.call(this, k, v)
    }
  })
  await page.goto('./')
  await page.getByRole('button', { name: '+250 ml' }).click()
  await expect(page.getByRole('status')).toContainText("Couldn't save")
})
