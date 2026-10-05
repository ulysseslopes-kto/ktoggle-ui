import { expect, test } from '@playwright/test'
import { createFeature, login, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'

/** datetime-local value in the browser's time zone, {@code days} from now at 10:00. */
function localDay(days: number, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

test('a scheduled rule stays out of the payload until its window opens', async ({ page, request }) => {
  const key = uniqueKey('e2e-sched')
  await createFeature(request, key)

  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Enable in stg' }).click()
  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeVisible()

  await page.getByRole('button', { name: 'Add rule' }).click()
  const dialog = page.getByRole('dialog', { name: 'New rule' })
  await dialog.getByPlaceholder('e.g. Beta for Brazil').fill('Launch day')
  await dialog.getByText('Schedule this rule').click()
  await dialog.getByLabel('End').fill(localDay(1))
  await dialog.getByLabel('Start').fill(localDay(2))
  await expect(dialog.getByText('The end must be after the start.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add rule' })).toBeDisabled()
  await dialog.getByLabel('End').fill(localDay(3))
  await page.screenshot({ path: 'e2e-report/screens/scheduled-rule.png' })
  await dialog.getByRole('button', { name: 'Add rule' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Scheduled', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Review & publish' }).click()
  const review = page.getByRole('dialog', { name: 'Review & publish' })
  await review.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publish draft' })
  await confirm.getByRole('textbox').fill('e2e schedule')
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(confirm).toBeHidden()

  // Live in staging, but the rule is not in the payload yet.
  await expect.poll(async () => Object.keys(await sdkPayload(request, STG))).toContain(key)
  expect(((await sdkPayload(request, STG))[key] as { rules?: unknown[] }).rules).toBeUndefined()

  await page.getByLabel('Environment').selectOption({ label: 'Staging' })
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await expect(page.getByText('defaultValue')).toBeVisible()

  await page.getByLabel('Evaluate at').fill(localDay(2, 12))
  await page.getByRole('button', { name: 'Evaluate' }).click()
  await expect(page.getByText('applied', { exact: true })).toBeVisible()
})
