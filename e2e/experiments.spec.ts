import { expect, test } from '@playwright/test'
import { createFeature, login, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'

test('an experiment rule splits users between variations and the test panel shows the assignment', async ({ page, request }) => {
  const key = uniqueKey('e2e-exp')
  await createFeature(request, key)

  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Enable in stg' }).click()
  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeVisible()

  await page.getByRole('button', { name: 'Add rule' }).click()
  const dialog = page.getByRole('dialog', { name: 'New rule' })
  await dialog.getByRole('button', { name: /Experiment/ }).click()
  await dialog.getByPlaceholder('e.g. New checkout button').fill('Three-way test')
  await dialog.getByRole('button', { name: 'Add variation' }).click()
  await expect(dialog.getByLabel('Variation 2 weight')).toHaveValue('33.34')

  // Weights must add up to 100% before the rule can be saved.
  await dialog.getByLabel('Variation 0 weight').fill('50')
  await expect(dialog.getByText(/must add up to 100%/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add rule' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Split evenly' }).click()
  await page.screenshot({ path: 'e2e-report/screens/experiment-rule.png' })
  await dialog.getByRole('button', { name: 'Add rule' }).click()
  await expect(dialog).toBeHidden()

  await expect(page.getByText('run experiment')).toBeVisible()
  await page.getByRole('button', { name: 'Review & publish' }).click()
  const review = page.getByRole('dialog', { name: 'Review & publish' })
  await review.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publish draft' })
  await confirm.getByRole('textbox').fill('e2e experiment')
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(confirm).toBeHidden()

  await expect
    .poll(async () => {
      const features = (await sdkPayload(request, STG)) as Record<string, { rules?: { key?: string; weights?: number[] }[] }>
      return features[key]?.rules?.[0]
    })
    .toMatchObject({ key, weights: [0.3333, 0.3333, 0.3334] })

  await page.getByLabel('Environment').selectOption({ label: 'Staging' })
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await expect(page.getByText(/In experiment/)).toBeVisible()
  await expect(page.getByText('The SDK reports this exposure to the tracking callback.')).toBeVisible()
})
