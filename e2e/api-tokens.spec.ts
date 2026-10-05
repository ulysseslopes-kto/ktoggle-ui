import { expect, test } from '@playwright/test'
import { login, uniqueKey, USERS } from './support'

const API = process.env.E2E_API_URL ?? 'http://localhost:8090'

test('an admin creates an API token, it works on the API and stops working once revoked', async ({ page, request }) => {
  const name = uniqueKey('e2e-token')

  await login(page, USERS.admin, '/api-tokens')
  await page.getByRole('button', { name: 'New token' }).click()
  const form = page.getByRole('dialog', { name: 'New API token' })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Role').selectOption('VIEWER')
  await form.getByRole('button', { name: 'Create token' }).click()

  const created = page.getByRole('dialog', { name: `Token ${name} created` })
  await expect(created.getByText('this secret cannot be shown again')).toBeVisible()
  const secret = await created.locator('span[title^="ktg_"]').getAttribute('title')
  expect(secret).toMatch(/^ktg_[0-9A-Za-z]{40}$/)
  await page.screenshot({ path: 'e2e-report/screens/api-token.png' })
  await created.getByRole('button', { name: 'Done' }).click()

  const call = () => request.get(`${API}/admin/v1/features`, { headers: { Authorization: `Bearer ${secret}` } })
  expect((await call()).status()).toBe(200)

  const row = page.getByRole('row').filter({ hasText: name })
  await expect(row.getByText('active')).toBeVisible()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await page.getByRole('dialog', { name: `Revoke ${name}?` }).getByRole('button', { name: 'Revoke token' }).click()
  await expect(row.getByText('revoked')).toBeVisible()
  expect((await call()).status()).toBe(401)
})

test('API tokens are not offered to non-admins', async ({ page }) => {
  await login(page, USERS.editor, '/features')
  await expect(page.getByRole('link', { name: 'API tokens' })).toHaveCount(0)
})
