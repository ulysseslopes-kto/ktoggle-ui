import { expect, test } from '@playwright/test'
import { login, token, uniqueKey, USERS } from './support'

const API = process.env.E2E_API_URL ?? 'http://localhost:8090'

test('an encrypted connection hides the features on the wire and the SDK decrypts them', async ({ page, request }) => {
  const name = uniqueKey('e2e encrypted')
  const created = await request.post(`${API}/admin/v1/sdk-connections`, {
    headers: { Authorization: `Bearer ${await token(request, USERS.admin)}` },
    data: { name, environmentKey: 'stg', encryptPayload: true },
  })
  expect(created.status()).toBe(201)
  const clientKey = (await created.json()).clientKey as string

  await expect
    .poll(async () => (await request.get(`${API}/api/features/${clientKey}`)).status())
    .toBe(200)
  const wire = await (await request.get(`${API}/api/features/${clientKey}`)).json()
  expect(wire.features).toEqual({})
  expect(wire.encryptedFeatures).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/)
  expect(JSON.stringify(wire)).not.toContain('new-checkout')

  await login(page, USERS.admin, `/sdk-connections/${clientKey}`)
  await expect(page.getByText('encrypted', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reveal key' }).click()
  await expect(page.locator('span[title$="=="]')).toBeVisible()

  await page.goto('/playground')
  await page.getByLabel('SDK connection').selectOption(clientKey)
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByText('Connected · SSE live')).toBeVisible()
  await expect(page.getByText('encrypted payload, decrypted by the SDK')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'new-checkout', exact: true })).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/encrypted-playground.png' })
})
