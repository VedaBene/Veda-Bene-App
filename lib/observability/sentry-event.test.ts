import { afterEach, describe, expect, it } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent, BrowserOptions } from '@sentry/nextjs'
import { privateSentryDataCollection, sanitizeSentryEvent } from './sentry-privacy'
import { capturePhotoFailure, recordPhotoProgress } from './photo-telemetry'
type Envelope = Parameters<ReturnType<NonNullable<BrowserOptions['transport']>>['send']>[0]

afterEach(async () => { Sentry.setUser(null); await Sentry.close() })
describe('synthetic event through the actual Sentry SDK (in-memory transport)', () => {
  it('serializes UUID, immutable release and retry tags without sending private data or recovered errors', async () => {
    const events: ErrorEvent[] = []
    Sentry.init({
      dsn: 'https://public@example.invalid/1', release: 'a'.repeat(40), enabled: true,
      defaultIntegrations: [], tracesSampleRate: 0, dataCollection: privateSentryDataCollection,
      beforeSend: sanitizeSentryEvent,
      transport: () => ({ send: async (envelope: Envelope) => {
        for (const [header, payload] of envelope[1]) if (header.type === 'event') events.push(payload as ErrorEvent)
        return { statusCode: 200 }
      }, flush: async () => true }),
    })
    Sentry.setUser({ id: '12345678-1234-4123-8123-123456789abc', email: 'synthetic@example.invalid', username: 'Synthetic Person' })
    recordPhotoProgress({ stage: 'finalization', attempt: 2, retryResult: 'recovered', recovered: true }, 'before', 'html_image')
    await Sentry.flush()
    expect(events).toEqual([])
    const failure = Object.assign(new Error('Synthetic Person https://example.invalid/storage/photo.jpg?token=synthetic-private'), { code: 'photo_variant_missing' })
    capturePhotoFailure(failure, { type: 'image/jpeg', size: 4000000 }, 'before', 'finalization',
      { stage: 'finalization', attempt: 2, retryResult: 'failed', recovered: false }, 'html_image')
    await Sentry.flush()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      release: 'a'.repeat(40), user: { id: '12345678-1234-4123-8123-123456789abc' },
      tags: { attempt: '2', decoder: 'html_image', stage: 'finalization', retry_result: 'failed', recovered: 'false' },
    })
    const serialized = JSON.stringify(events[0])
    for (const privateValue of ['synthetic@example.invalid', 'Synthetic Person', 'synthetic-private', 'photo.jpg']) expect(serialized).not.toContain(privateValue)
    expect(events[0].exception?.values?.[0].stacktrace?.frames?.length).toBeGreaterThan(0)
  })
})
