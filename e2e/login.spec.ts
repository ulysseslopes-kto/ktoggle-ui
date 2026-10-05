import { expect, test } from '@playwright/test'
import { login, logout, USERS } from './support'

test('the login page carries the ktoggle identity', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Entrar · ktoggle')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByText('auditáveis')).toBeVisible()
  await expect(page.getByLabel('Usuário')).toBeVisible()
  await expect(page.getByLabel('Senha')).toBeVisible()
  await expect(page.getByText(/mobilt/i)).toHaveCount(0)
  await page.screenshot({ path: 'e2e-report/screens/login.png', fullPage: true })
})

test('wrong password is rejected with a clear message', async ({ page }) => {
  await page.goto('/')
  await page.locator('#username').fill(USERS.editor.username)
  await page.locator('#password').fill('wrong')
  await page.locator('#kc-login').click()
  await expect(page.getByText('Usuário ou senha inválidos.')).toBeVisible()
})

test('signing in lands on the feature list and signing out returns to the login', async ({ page }) => {
  await login(page, USERS.admin)
  await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible()
  await expect(page.getByText('new-checkout')).toBeVisible()
  await expect(page.getByText('Admin Local')).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/features.png', fullPage: true })
  await logout(page)
})

test('viewers can read but not change anything', async ({ page }) => {
  await login(page, USERS.viewer)
  await expect(page.getByRole('button', { name: 'Nova feature' })).toHaveCount(0)
  await page.getByText('new-checkout').click()
  await expect(page.getByRole('button', { name: 'Novo draft' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar regra' })).toHaveCount(0)
})
