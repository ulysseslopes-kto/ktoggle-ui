import { expect, test } from '@playwright/test'
import { login, USERS } from './support'

/** Needs the local demo GrowthBook (docker compose --profile growthbook, then local-infra/growthbook/seed.mjs). */
const GROWTHBOOK = process.env.E2E_GROWTHBOOK_URL ?? 'http://localhost:3400'
const GB_CLIENT_KEY = process.env.E2E_GROWTHBOOK_CLIENT_KEY ?? 'sdk-46eVWBICRMOJ8mHs'

test('import from GrowthBook, then shadow mode proves ktoggle serves the same values', async ({ page, request }) => {
  const up = await request.get(`${GROWTHBOOK}/healthcheck`).then((r) => r.ok()).catch(() => false)
  test.skip(!up, 'local GrowthBook not running')

  await login(page, USERS.admin, '/migration')
  await expect(page.getByText('http://growthbook:3100')).toBeVisible()

  await page.getByRole('button', { name: 'Dry run' }).click()
  await expect(page.getByText('Dry run', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByRole('dialog', { name: 'Import from GrowthBook?' }).getByRole('button', { name: 'Import now' }).click()
  await expect(page.getByText('Imported', { exact: true })).toBeVisible()
  await expect(page.locator('td', { hasText: 'failed' })).toHaveCount(0)

  const row = page.getByRole('row').filter({ hasText: GB_CLIENT_KEY })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Compare now' }).click()
    await expect(page.getByRole('button', { name: 'Compare now' })).toBeEnabled()
  }
  await expect(row.getByText('match', { exact: true })).toBeVisible()
  await expect(row.getByText('ready to migrate')).toBeVisible()

  await row.getByRole('button', { name: /Details of/ }).click()
  await expect(page.getByText(/2000 simulated users × 5 features/)).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/migration.png', fullPage: true })
})
