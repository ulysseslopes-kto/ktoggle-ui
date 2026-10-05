import { expect, test } from '@playwright/test'
import { createFeature, login, uniqueKey, USERS } from './support'

test('the SDK playground receives a published change live over SSE', async ({ page, request }) => {
  const key = uniqueKey('e2e-live')
  await createFeature(request, key)

  await login(page, USERS.editor, '/playground')
  await page.getByRole('combobox').first().selectOption('sdk-demostg00001')
  await page.getByRole('button', { name: 'Conectar' }).click()
  await expect(page.getByText('SSE ativo')).toBeVisible()
  await expect(page.getByText(key)).toHaveCount(0)

  // Publish in another tab, as a person would during the demo.
  const admin = await page.context().newPage()
  await admin.goto(`/features/${key}`)
  await admin.getByRole('button', { name: /Staging/ }).click()
  await admin.getByRole('switch', { name: 'Ativar em stg' }).click()
  await admin.getByRole('button', { name: 'Revisar e publicar' }).click()
  const review = admin.getByRole('dialog', { name: 'Revisar e publicar' })
  await review.getByRole('button', { name: 'Publicar', exact: true }).click()
  const confirm = admin.getByRole('dialog', { name: 'Publicar draft' })
  await confirm.getByRole('button', { name: 'Publicar', exact: true }).click()
  await admin.close()

  await expect(page.getByText(key).first()).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'e2e-report/screens/playground-live.png' })
})
