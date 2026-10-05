import { expect, test, type Page } from '@playwright/test'
import { createFeature, login, logout, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'
const PRD = 'sdk-demoprd00001'

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Review & publish' }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & publish' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function publish(page: Page) {
  const review = page.getByRole('dialog', { name: 'Review & publish' })
  await review.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publish draft' })
  await confirm.getByRole('textbox').fill('e2e test')
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(confirm).toBeHidden()
}

test('a change in an unprotected environment goes live only after publishing the draft', async ({ page, request }) => {
  const key = uniqueKey('e2e-stg')
  await createFeature(request, key)

  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Enable in stg' }).click()

  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeVisible()
  expect(await sdkPayload(request, STG)).not.toHaveProperty(key)

  const review = await openReview(page)
  await expect(review.getByText('Environment stg', { exact: true })).toBeVisible()
  await expect(review.getByText('After publishing')).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/review-diff.png' })
  await publish(page)

  await expect.poll(async () => Object.keys(await sdkPayload(request, STG))).toContain(key)
})

test('production requires an approval from someone else (four eyes)', async ({ page, request }) => {
  const key = uniqueKey('e2e-prd')
  await createFeature(request, key)

  // Editor proposes the change and asks for a review: publishing is not possible.
  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Production/ }).click()
  await page.getByRole('switch', { name: 'Enable in prd' }).click()
  let review = await openReview(page)
  await expect(review.getByText(/requires approval from someone else/)).toBeVisible()
  await expect(review.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)
  await review.getByPlaceholder(/Comment/).fill('Turning it on in production, can you review?')
  await review.getByRole('button', { name: 'Request review' }).click()
  await expect(review.getByText('Pending review').first()).toBeVisible()
  await logout(page)

  // Approver finds it in the review queue and approves.
  await login(page, USERS.approver, '/drafts')
  await page.getByRole('link', { name: key }).click()
  review = page.getByRole('dialog', { name: 'Review & publish' })
  await expect(review.getByText('Turning it on in production, can you review?')).toBeVisible()
  await review.getByRole('button', { name: 'Approve' }).click()
  await expect(review.getByText('Approved').first()).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/approved.png' })
  await logout(page)

  // Author publishes the approved draft.
  expect(await sdkPayload(request, PRD)).not.toHaveProperty(key)
  await login(page, USERS.editor, '/drafts')
  await page.getByRole('button', { name: 'Approved' }).click()
  await page.getByRole('link', { name: key }).click()
  await publish(page)
  await expect.poll(async () => Object.keys(await sdkPayload(request, PRD))).toContain(key)
})

test('authors cannot approve their own drafts', async ({ page, request }) => {
  const key = uniqueKey('e2e-self')
  await createFeature(request, key)
  await login(page, USERS.admin, `/features/${key}`)
  await page.getByRole('button', { name: /Production/ }).click()
  await page.getByRole('switch', { name: 'Enable in prd' }).click()
  const review = await openReview(page)
  await review.getByRole('button', { name: 'Request review' }).click()
  await expect(review.getByText('Pending review').first()).toBeVisible()
  await expect(review.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(review.getByRole('button', { name: 'Publish without approval' })).toBeVisible()
})
