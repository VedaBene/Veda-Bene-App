import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrowserOptions, ErrorEvent } from '@sentry/nextjs'
const init = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ init }))
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); init.mockClear() })
describe('client/server/edge Sentry configuration', () => {
  it.each(['client', 'server', 'edge'])('correlates a private synthetic event with the build release on %s', async runtime => {
    const sha = '1234567890abcdef1234567890abcdef12345678'
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', sha)
    vi.stubEnv('SENTRY_RELEASE', 'runtime-value-must-not-override-build')
    if (runtime === 'client') await import('../../sentry.client.config')
    else if (runtime === 'server') await import('../../sentry.server.config')
    else await import('../../sentry.edge.config')
    const options = init.mock.calls[0][0] as BrowserOptions
    expect(options.release).toBe(sha)
    expect(options.ignoreErrors).toBeUndefined()
    expect(options.dataCollection).toMatchObject({ userInfo: false, httpBodies: [], cookies: false, urlQueryParams: false })
    const event: ErrorEvent = {
      type: undefined,
      release: options.release,
      user: { id: '12345678-1234-4123-8123-123456789abc', email: 'synthetic@example.invalid' },
      tags: { area: 'cleaning-photo', attempt: '2', recovered: 'false', decoder: 'html_image', retry_result: 'failed' },
      exception: { values: [{ type: 'Error', value: 'Cleaning photo failure: photo_variant_missing' }] },
    }
    const result = await options.beforeSend!(event, {})
    expect(result).toMatchObject({ release: sha, user: { id: event.user!.id }, tags: event.tags })
    expect(JSON.stringify(result)).not.toContain('synthetic@example.invalid')
  })
})
