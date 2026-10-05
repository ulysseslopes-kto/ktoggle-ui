import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { login, uniqueKey, USERS } from './support'

/** The API runs in Docker; it reaches this receiver on the host through host.docker.internal. */
const RECEIVER_HOST = process.env.E2E_RECEIVER_HOST ?? 'host.docker.internal'

let server: Server
const received: { headers: IncomingHttpHeaders; body: string }[] = []

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      received.push({ headers: req.headers, body })
      res.writeHead(204).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve))
})

test.afterAll(() => server.close())

test('an admin creates a webhook and a test notification is delivered, signed', async ({ page }) => {
  const name = uniqueKey('e2e-hook')
  const port = (server.address() as AddressInfo).port

  await login(page, USERS.admin, '/webhooks')
  await page.getByRole('button', { name: 'New webhook' }).click()
  const form = page.getByRole('dialog', { name: 'New webhook' })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Format').selectOption('GENERIC')
  await form.getByLabel('URL').fill(`http://${RECEIVER_HOST}:${port}/hook`)
  await form.getByRole('button', { name: 'Create webhook' }).click()

  const created = page.getByRole('dialog', { name: `Webhook ${name} created` })
  await expect(created.getByText('it is not shown again')).toBeVisible()
  await created.getByRole('button', { name: 'Done' }).click()

  const card = page.locator('div.rounded-xl').filter({ hasText: name })
  await card.getByRole('button', { name: 'Send test' }).click()
  await expect.poll(() => received.filter((r) => r.headers['x-ktoggle-event'] === 'webhook.test').length, { timeout: 15_000 })
    .toBeGreaterThan(0)
  const delivery = received.find((r) => r.headers['x-ktoggle-event'] === 'webhook.test')!
  expect(delivery.headers['x-ktoggle-signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
  expect(JSON.parse(delivery.body)).toMatchObject({ event: 'webhook.test', actor: 'admin.local' })

  await expect(card.getByText('delivered')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'e2e-report/screens/webhooks.png' })

  await card.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('dialog', { name: `Delete ${name}?` }).getByRole('button', { name: 'Delete webhook' }).click()
  await expect(card).toHaveCount(0)
})
