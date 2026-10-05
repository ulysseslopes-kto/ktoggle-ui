import { expect, test } from '@playwright/test'
import { login, logout, token, uniqueKey, USERS } from './support'

const API = process.env.E2E_API_URL ?? 'http://localhost:8090'

test('a restricted project is read-only for editors who are not listed', async ({ page, request }) => {
  const project = uniqueKey('e2e-proj')
  const feature = uniqueKey('e2e-locked')

  await login(page, USERS.admin, '/projects')
  await page.getByRole('button', { name: 'New project' }).click()
  const dialog = page.getByRole('dialog', { name: 'New project' })
  await dialog.getByLabel('Key').fill(project)
  await dialog.getByLabel('Name').fill('Restricted e2e project')
  const users = dialog.getByPlaceholder('username or token:<name>')
  await users.fill(USERS.approver.username)
  await users.press('Enter')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('row').filter({ hasText: project })
  await expect(row.getByLabel('Restricted')).toBeVisible()
  await expect(row.getByText(USERS.approver.username)).toBeVisible()

  const response = await request.post(`${API}/admin/v1/features`, {
    headers: { Authorization: `Bearer ${await token(request, USERS.admin)}` },
    data: { key: feature, valueType: 'BOOLEAN', defaultValue: false, projectKey: project },
  })
  expect(response.status()).toBe(201)
  await logout(page)

  await login(page, USERS.editor, `/features/${feature}`)
  await expect(page.getByText('can change this feature', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: /Staging/ }).click()
  await expect(page.getByRole('switch', { name: 'Enable in stg' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'New draft' })).toHaveCount(0)
  await page.screenshot({ path: 'e2e-report/screens/project-locked.png' })

  const denied = await request.post(`${API}/admin/v1/features/${feature}/drafts`, {
    headers: { Authorization: `Bearer ${await token(request, USERS.editor)}` },
    data: { title: 'sneaky' },
  })
  expect(denied.status()).toBe(403)
})
