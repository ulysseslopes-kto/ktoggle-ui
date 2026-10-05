import { accessToken } from '@/auth/auth'
import { config } from '@/config'

/** Error contract of the ktoggle API: {@code message}, a stable {@code messageCode} and optional {@code data}. */
export class ApiError extends Error {
  readonly status: number
  readonly messageCode?: string
  readonly details: string[]

  constructor(status: number, message: string, messageCode?: string, data?: unknown) {
    super(message)
    this.status = status
    this.messageCode = messageCode
    this.details = Array.isArray(data) ? data.map(String) : []
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Sent as X-Ktoggle-Reason: recorded in the audit trail and the revision history. */
  reason?: string
  query?: Record<string, string | number | boolean | undefined | null>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, config.apiUrl)
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}` }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.reason) headers['X-Ktoggle-Reason'] = options.reason
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    throw new ApiError(response.status, json?.message ?? response.statusText, json?.messageCode, json?.data)
  }
  return json as T
}
