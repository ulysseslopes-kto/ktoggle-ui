import { expect, test } from '@playwright/test'
import { login, token, uniqueKey, USERS } from './support'

const API = process.env.E2E_API_URL ?? 'http://localhost:8090'

test('remote evaluation serves values only and the SDK still tracks experiment exposures', async ({ page, request }) => {
  const created = await request.post(`${API}/admin/v1/sdk-connections`, {
    headers: { Authorization: `Bearer ${await token(request, USERS.admin)}` },
    data: { name: uniqueKey('e2e remote'), environmentKey: 'stg', remoteEval: true },
  })
  expect(created.status()).toBe(201)
  const clientKey = (await created.json()).clientKey as string

  await expect.poll(async () => (await request.get(`${API}/api/features/${clientKey}`)).status()).toBe(200)
  expect((await (await request.get(`${API}/api/features/${clientKey}`)).json()).features).toEqual({})
  const evaluated = await (await request.post(`${API}/api/eval/${clientKey}`, { data: { attributes: { id: 'user-42' } } })).json()
  expect(evaluated.features['deposit-button-copy'].defaultValue).toEqual(expect.any(String))
  expect(JSON.stringify(evaluated)).not.toContain('coverage')

  await login(page, USERS.admin, `/sdk-connections/${clientKey}`)
  await expect(page.getByText('remote evaluation', { exact: true })).toBeVisible()
  await expect(page.getByText('remoteEval: true', { exact: false })).toBeVisible()

  await page.goto('/playground')
  await page.getByLabel('SDK connection').selectOption(clientKey)
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByText('Connected · SSE live')).toBeVisible()
  await expect(page.getByText('remote evaluation: values computed by ktoggle')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'deposit-button-copy', exact: true })).toBeVisible()
  await expect(page.getByText(/Exposure tracked: deposit-button-copy → variation #\d/)).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/remote-eval-playground.png' })
})
