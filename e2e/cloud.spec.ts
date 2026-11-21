import AxeBuilder from '@axe-core/playwright'
import { OTP_CODE, cloudRow, day, entry, expect, mockSupabase, readData, seed, seedData, signedIn, test } from './fixtures'

const meals = (count: number, name = 'Chicken rice') => Array.from({ length: count }, (_, i) => entry(day(-i), 'lunch', `${name} ${i}`, 600))

async function openCloud(page: import('@playwright/test').Page) {
  await page.locator('nav.tabbar').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Cloud backup/ }).click()
  await expect(page.getByRole('heading', { name: 'Cloud backup' })).toBeVisible()
}

test('sign in with an emailed code and the diary backs up', async ({ page }) => {
  const cloud = await mockSupabase(page)
  await seed(page, seedData({ entries: meals(3) }))
  await page.goto('./')
  await openCloud(page)

  await page.getByLabel('Email').fill('me@example.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Code sent to me@example.com')).toBeVisible()
  expect(cloud.codesSent).toEqual(['me@example.com'])

  // A wrong code is explained, not silently ignored.
  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('status').filter({ hasText: /invalid/ })).toBeVisible()

  await page.getByLabel('6-digit code').fill(OTP_CODE)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Signed in as')).toBeVisible()
  await expect(page.locator('#cloud-status')).toContainText('Backed up just now')
  expect(cloud.rows).toHaveLength(1)
  expect(cloud.rows[0]).toMatchObject({ day: day(), entry_count: 3 })
  // Counts as a backup, so the reminder banner stays away.
  expect((await readData(page)).meta.lastBackupAt).toBeGreaterThan(Date.now() - 60_000)

  // Stays signed in after a reload.
  await page.reload()
  await openCloud(page)
  await expect(page.getByText('Signed in as')).toBeVisible()
})

test('changes back up automatically a moment after they are made', async ({ page }) => {
  const cloud = await mockSupabase(page)
  await seed(page, seedData({ entries: meals(2) }))
  await signedIn(page) // after seed(), which clears localStorage
  await page.goto('./')
  await expect.poll(() => cloud.rows.length).toBe(1)

  await page.getByRole('button', { name: '+250 ml' }).click()
  await expect.poll(() => (cloud.rows[0]?.data.water as Record<string, number> | undefined)?.[day()]).toBe(250)
  // Still one snapshot for today, replaced rather than duplicated.
  expect(cloud.rows).toHaveLength(1)
})

test('a wiped browser never overwrites the cloud backup, and can restore it', async ({ page }) => {
  const backup = seedData({ entries: meals(20, 'Laksa') })
  const cloud = await mockSupabase(page, [cloudRow(day(-1), backup)])
  await seed(page, null) // fresh install, as after the browser cleared its data
  await signedIn(page) // after seed(), which clears localStorage
  await page.goto('./')

  // Not set up yet: nothing is uploaded.
  await page.waitForTimeout(1500)
  expect(cloud.uploads).toBe(0)

  // Skipping set-up leaves an empty diary, which must not replace the 20-entry backup.
  await page.getByRole('button', { name: 'Use defaults' }).click()
  const paused = page.getByRole('region', { name: 'Cloud backup paused' })
  await expect(paused).toBeVisible()
  expect(cloud.uploads).toBe(0)

  await paused.getByRole('button', { name: 'Review cloud backup' }).click()
  await expect(page.locator('#cloud-status')).toContainText('Paused')
  await page.getByRole('button', { name: 'Show backups' }).click()
  const list = page.getByRole('list', { name: 'Cloud backups' })
  await expect(list.getByText('20 entries')).toBeVisible()

  page.once('dialog', (d) => {
    expect(d.message()).toContain('20 diary entries')
    void d.accept()
  })
  await list.getByRole('button', { name: /Restore/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Restored backup' })).toBeVisible()
  expect((await readData(page)).entries).toHaveLength(20)
  await expect(page.locator('#cloud-status')).not.toContainText('Paused')
})

test('the welcome card offers a restore on a new device', async ({ page }) => {
  await mockSupabase(page, [cloudRow(day(), seedData({ entries: meals(5) }))])
  await seed(page, null)
  await page.goto('./')
  await page.getByRole('button', { name: 'Restore from cloud backup' }).click()
  await expect(page.getByRole('heading', { name: 'Cloud backup' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('shows a clear error when the backup server is unreachable', async ({ page }) => {
  const cloud = await mockSupabase(page)
  await seed(page, seedData({ entries: meals(2) }))
  await signedIn(page) // after seed(), which clears localStorage
  cloud.fail = true
  await page.goto('./')
  await openCloud(page)
  // supabase-js retries a few times on its own before giving up.
  await expect(page.locator('#cloud-status')).toContainText("Couldn't reach the backup server", { timeout: 20_000 })

  cloud.fail = false
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.locator('#cloud-status')).toContainText('Backed up just now')
  expect(cloud.rows).toHaveLength(1)
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`cloud backup screen (${colorScheme}) has no WCAG AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await mockSupabase(page, [cloudRow(day(-1), seedData({ entries: meals(4) }))])
    await seed(page, seedData({ entries: meals(4) }))
    await signedIn(page) // after seed(), which clears localStorage
    await page.goto('./')
    await openCloud(page)
    await page.getByRole('button', { name: 'Show backups' }).click()
    await expect(page.getByRole('list', { name: 'Cloud backups' })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`)).toEqual([])
  })
}
