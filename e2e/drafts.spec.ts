import { expect, test, type Page } from '@playwright/test'
import { createFeature, login, logout, sdkPayload, uniqueKey, USERS } from './support'

const STG = 'sdk-demostg00001'
const PRD = 'sdk-demoprd00001'

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Revisar e publicar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisar e publicar' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function publish(page: Page) {
  const review = page.getByRole('dialog', { name: 'Revisar e publicar' })
  await review.getByRole('button', { name: 'Publicar', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Publicar draft' })
  await confirm.getByRole('textbox').fill('teste e2e')
  await confirm.getByRole('button', { name: 'Publicar', exact: true }).click()
  await expect(confirm).toBeHidden()
}

test('a change in an unprotected environment goes live only after publishing the draft', async ({ page, request }) => {
  const key = uniqueKey('e2e-stg')
  await createFeature(request, key)

  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Staging/ }).click()
  await page.getByRole('switch', { name: 'Ativar em stg' }).click()

  await expect(page.getByRole('button', { name: 'Revisar e publicar' })).toBeVisible()
  expect(await sdkPayload(request, STG)).not.toHaveProperty(key)

  const review = await openReview(page)
  await expect(review.getByText('Ambiente stg', { exact: true })).toBeVisible()
  await expect(review.getByText('Após publicar')).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/review-diff.png' })
  await publish(page)

  await expect.poll(async () => Object.keys(await sdkPayload(request, STG))).toContain(key)
})

test('production requires an approval from someone else (four eyes)', async ({ page, request }) => {
  const key = uniqueKey('e2e-prd')
  await createFeature(request, key)

  // Editor proposes the change and asks for a review: publishing is not possible.
  await login(page, USERS.editor, `/features/${key}`)
  await page.getByRole('button', { name: /Produção/ }).click()
  await page.getByRole('switch', { name: 'Ativar em prd' }).click()
  let review = await openReview(page)
  await expect(review.getByText(/exige aprovação de outra pessoa/)).toBeVisible()
  await expect(review.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0)
  await review.getByPlaceholder(/Comentário/).fill('Liberar em produção, pode revisar?')
  await review.getByRole('button', { name: 'Solicitar revisão' }).click()
  await expect(review.getByText('Aguardando revisão').first()).toBeVisible()
  await logout(page)

  // Approver finds it in the review queue and approves.
  await login(page, USERS.approver, '/drafts')
  await page.getByRole('link', { name: key }).click()
  review = page.getByRole('dialog', { name: 'Revisar e publicar' })
  await expect(review.getByText('Liberar em produção, pode revisar?')).toBeVisible()
  await review.getByRole('button', { name: 'Aprovar' }).click()
  await expect(review.getByText('Aprovado').first()).toBeVisible()
  await page.screenshot({ path: 'e2e-report/screens/approved.png' })
  await logout(page)

  // Author publishes the approved draft.
  expect(await sdkPayload(request, PRD)).not.toHaveProperty(key)
  await login(page, USERS.editor, '/drafts')
  await page.getByRole('button', { name: 'Aprovados' }).click()
  await page.getByRole('link', { name: key }).click()
  await publish(page)
  await expect.poll(async () => Object.keys(await sdkPayload(request, PRD))).toContain(key)
})

test('authors cannot approve their own drafts', async ({ page, request }) => {
  const key = uniqueKey('e2e-self')
  await createFeature(request, key)
  await login(page, USERS.admin, `/features/${key}`)
  await page.getByRole('button', { name: /Produção/ }).click()
  await page.getByRole('switch', { name: 'Ativar em prd' }).click()
  const review = await openReview(page)
  await review.getByRole('button', { name: 'Solicitar revisão' }).click()
  await expect(review.getByText('Aguardando revisão').first()).toBeVisible()
  await expect(review.getByRole('button', { name: 'Aprovar' })).toHaveCount(0)
  await expect(review.getByRole('button', { name: 'Publicar sem aprovação' })).toBeVisible()
})
