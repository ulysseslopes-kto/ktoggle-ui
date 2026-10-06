import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

vi.mock('@/auth/auth', () => ({ accessToken: async () => 'token' }))

const respond = (status: number, body: string, statusText = '') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, statusText })))

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the parsed body', async () => {
    respond(200, '{"key":"checkout"}')
    await expect(api('/admin/v1/features/checkout')).resolves.toEqual({ key: 'checkout' })
  })

  it('keeps the error contract of the API', async () => {
    respond(409, '{"message":"Draft version is stale","messageCode":"CONFLICT","data":["version"]}')
    const error = await api('/admin/v1/drafts/1/metadata').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Draft version is stale', messageCode: 'CONFLICT', details: ['version'] })
  })

  it('turns an HTML gateway page into an ApiError with the status', async () => {
    respond(502, '<html><body>Bad Gateway</body></html>', 'Bad Gateway')
    const error = await api('/admin/v1/features').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, message: '502 Bad Gateway' })
  })
})
