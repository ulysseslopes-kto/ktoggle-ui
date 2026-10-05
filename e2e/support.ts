import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** Local, disposable users from ktoggle/local-infra/keycloak/ktoggle-realm.json. */
export const USERS = {
  admin: { username: 'admin.local', password: 'admin' },
  editor: { username: 'editor.local', password: 'editor' },
  approver: { username: 'approver.local', password: 'approver' },
  viewer: { username: 'viewer.local', password: 'viewer' },
} as const

export type User = (typeof USERS)[keyof typeof USERS]

const API = process.env.E2E_API_URL ?? 'http://localhost:8090'
const KEYCLOAK = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8180'

/** Signs in through the ktoggle-branded Keycloak page. */
export async function login(page: Page, user: User, path = '/features') {
  await page.goto(path)
  await expect(page.locator('.kt-wordmark').first()).toBeVisible()
  await page.locator('#username').fill(user.username)
  await page.locator('#password').fill(user.password)
  await page.locator('#kc-login').click()
  await expect(page.getByRole('navigation')).toBeVisible()
}

export async function logout(page: Page) {
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.locator('#kc-login')).toBeVisible()
}

/** Admin API access for test setup (password grant is enabled only for the local client). */
export async function token(request: APIRequestContext, user: User): Promise<string> {
  const response = await request.post(`${KEYCLOAK}/realms/ktoggle/protocol/openid-connect/token`, {
    form: { client_id: 'ktoggle-ui', grant_type: 'password', username: user.username, password: user.password },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).access_token as string
}

export async function createFeature(request: APIRequestContext, key: string): Promise<void> {
  const response = await request.post(`${API}/admin/v1/features`, {
    headers: { Authorization: `Bearer ${await token(request, USERS.editor)}` },
    data: { key, valueType: 'BOOLEAN', defaultValue: false, description: 'Created by the e2e tests', tags: ['e2e'] },
  })
  expect(response.status()).toBe(201)
}

export async function sdkPayload(request: APIRequestContext, clientKey: string): Promise<Record<string, unknown>> {
  const response = await request.get(`${API}/api/features/${clientKey}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).features as Record<string, unknown>
}

export const uniqueKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}`
