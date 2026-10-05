import { expect, test } from '@playwright/test'
import { createFeature, login, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'

test('a feature with an unmet prerequisite is off and the parent lists its dependents', async ({ page, request }) => {
  const parent = uniqueKey('e2e-parent')
  const child = uniqueKey('e2e-child')
  await createFeature(request, parent)
  await createFeature(request, child)

  await login(page, USERS.editor, `/features/${child}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Enable in stg' }).click()
  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).last().click()
  const dialog = page.getByRole('dialog', { name: 'Prerequisites' })
  await dialog.getByRole('button', { name: 'Add prerequisite' }).click()
  await dialog.getByLabel('Prerequisite feature').selectOption(parent)
  await expect(dialog.getByLabel('Prerequisite state')).toHaveValue('on')
  await page.screenshot({ path: 'e2e-report/screens/prerequisites.png' })
  await dialog.getByRole('button', { name: 'Save to draft' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name: parent })).toBeVisible()

  await page.getByRole('button', { name: 'Review & publish' }).click()
  const review = page.getByRole('dialog', { name: 'Review & publish' })
  await expect(review.getByText(`${parent} is on (true)`)).toBeVisible()
  await review.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publish draft' })
  await confirm.getByRole('textbox').fill('e2e prerequisite')
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(confirm).toBeHidden()

  await expect
    .poll(async () => {
      const features = (await sdkPayload(request, STG)) as Record<string, { rules?: { parentConditions?: { id: string; gate?: boolean }[] }[] }>
      return features[child]?.rules?.[0]?.parentConditions?.[0]
    })
    .toMatchObject({ id: parent, gate: true })

  await page.getByLabel('Environment').selectOption({ label: 'Staging' })
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await expect(page.getByText('A prerequisite feature did not pass for this user, so the feature is off.')).toBeVisible()

  await page.goto(`/features/${parent}`)
  await expect(page.getByRole('link', { name: child })).toBeVisible()
  await expect(page.getByText('whole feature')).toBeVisible()
})
