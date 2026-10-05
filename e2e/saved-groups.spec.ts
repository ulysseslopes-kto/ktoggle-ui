import { expect, test } from '@playwright/test'
import { createFeature, login, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'

test('a rule can target any of several saved groups and exclude another', async ({ page, request }) => {
  const key = uniqueKey('e2e-groups')
  await createFeature(request, key)

  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Enable in stg' }).click()
  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeVisible()

  await page.getByRole('button', { name: 'Add rule' }).click()
  const dialog = page.getByRole('dialog', { name: 'New rule' })
  await dialog.getByLabel('Saved group Beta testers').selectOption('any')
  await dialog.getByLabel('Saved group Mobile users').selectOption('any')
  await dialog.getByLabel('Saved group VIPs').selectOption('none')
  await page.screenshot({ path: 'e2e-report/screens/saved-groups.png' })
  await dialog.getByRole('button', { name: 'Add rule' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('in any of', { exact: false })).toBeVisible()
  await expect(page.getByText('not in', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Review & publish' }).click()
  const review = page.getByRole('dialog', { name: 'Review & publish' })
  await review.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publish draft' })
  await confirm.getByRole('textbox').fill('e2e saved groups')
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(confirm).toBeHidden()

  await expect
    .poll(async () => {
      const features = (await sdkPayload(request, STG)) as Record<string, { rules?: { condition?: { $and?: object[] } }[] }>
      const parts = features[key]?.rules?.[0]?.condition?.$and ?? []
      return parts.map((part) => Object.keys(part)[0])
    })
    .toEqual(['$or', '$nor'])
})
