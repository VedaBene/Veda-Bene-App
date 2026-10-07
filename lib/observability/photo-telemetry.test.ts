import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { capturePhotoFailure, recordPhotoProgress } from './photo-telemetry'
import { sanitizeSentryEvent } from './sentry-privacy'
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
describe('photo telemetry privacy and classification', () => {
  it('keeps recovered retries informational', () => {
    recordPhotoProgress({ stage: 'finalization', attempt: 2, retryResult: 'recovered', recovered: true }, 'after', 'html_image')
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', data: expect.objectContaining({ recovered: 'true', attempt: '2', decoder: 'html_image' }) }))
  })
  it('captures unexpected errors with safe messages and stable unknown code/decoder', () => {
    const error = Object.assign(new Error('Synthetic Person synthetic@example.invalid'), { code: 'arbitrary-name', details: { token: 'synthetic-private' } })
    capturePhotoFailure(error, { type: 'private-content-type', size: 9000000 }, 'before', 'processing')
    const [exception, context] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(exception).toMatchObject({ message: 'Cleaning photo failure: workflow_error' })
    expect(context).toMatchObject({ tags: { failure_code: 'workflow_error', decoder: 'unknown', attempt: '1', recovered: 'false' } })
    const sanitized = sanitizeSentryEvent({ type: undefined, tags: (context as { tags: Record<string, string> }).tags, extra: (context as { extra: Record<string, unknown> }).extra, exception: { values: [{ type: 'Error', value: (exception as Error).message }] } })
    expect(JSON.stringify(sanitized)).not.toContain('Synthetic Person')
    expect(JSON.stringify(sanitized)).not.toContain('synthetic-private')
  })
  it('retains expected business errors until Stage 5 explicitly changes their handling', () => {
    capturePhotoFailure(Object.assign(new Error('Limite'), { code: 'photo_limit_reached' }), { type: 'image/jpeg', size: 1 }, 'before', 'reservation')
    expect(Sentry.captureException).toHaveBeenCalledOnce()
  })
})
