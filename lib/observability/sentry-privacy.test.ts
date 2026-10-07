import { describe, expect, it } from 'vitest'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'
import { pseudonymousSentryUser, sanitizeSentryEvent } from './sentry-privacy'

const id = '12345678-1234-4123-8123-123456789abc'
describe('private Sentry events', () => {
  it('keeps UUID/release/attempt and technical frames while removing identity and payloads everywhere', () => {
    const email = 'synthetic.person@example.invalid'
    const name = 'Synthetic Person'
    const token = 'synthetic-private-value'
    const signed = `https://example.invalid/storage/v1/object/sign/private/photo.jpg?token=${token}`
    const event: ErrorEvent = {
      type: undefined,
      user: { id, email, username: name, ip_address: '192.0.2.1' }, release: 'a'.repeat(40),
      tags: { area: 'cleaning-photo', attempt: '2', recovered: 'false', email, name, token },
      extra: { sourcePixels: 12000000, email, name, photo: signed, token },
      contexts: { private_profile: { name, email }, browser: { name: 'Chrome', version: '123', email } },
      request: { method: 'POST', url: signed, headers: { Authorization: token }, cookies: { session: token }, data: { email, name } },
      breadcrumbs: [{ category: 'console', message: name, data: { arguments: [token, email] } },
        { category: 'cleaning-photo.upload', data: { attempt: '2', recovered: 'false', token, photo: signed } }],
      exception: { values: [{ type: 'TypeError', value: `Failed to fetch ${signed} ${email} token=${token}`,
        mechanism: { type: 'generic', handled: true, data: { name, token } },
        stacktrace: { frames: [{ filename: `https://app.example.invalid/_next/static/chunks/app.js?token=${token}`,
          function: 'uploadVariant', lineno: 42, colno: 3, vars: { name, token }, context_line: email }] } }] },
    }
    const hint: EventHint = { attachments: [{ filename: 'photo.jpg', data: new Uint8Array([1, 2]) }] }
    const sanitized = sanitizeSentryEvent(event, hint)
    const serialized = JSON.stringify(sanitized)
    for (const privateValue of [email, name, token, signed, '192.0.2.1']) expect(serialized).not.toContain(privateValue)
    expect(sanitized.user).toEqual({ id })
    expect(sanitized.release).toBe('a'.repeat(40))
    expect(sanitized.tags).toMatchObject({ attempt: '2', recovered: 'false' })
    expect(sanitized.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({
      filename: 'https://app.example.invalid/_next/static/chunks/app.js', function: 'uploadVariant', lineno: 42,
    })
    expect(hint.attachments).toEqual([])
  })
  it.each(['Failed to fetch', 'Load failed', 'Maximum call stack size exceeded', "Failed to execute 'removeChild'"])('never hides a technical error: %s', value => {
    const event: ErrorEvent = { type: undefined, exception: { values: [{ type: 'Error', value }] } }
    expect(sanitizeSentryEvent(event).exception?.values?.[0].value).toBe(value)
  })
  it('accepts only UUID identities and drops arbitrary IDs/email', () => {
    expect(pseudonymousSentryUser(id)).toEqual({ id })
    expect(pseudonymousSentryUser('synthetic@example.invalid')).toBeNull()
    expect(pseudonymousSentryUser(123)).toBeNull()
    expect(sanitizeSentryEvent({ type: undefined, user: { id: 'name', email: 'synthetic@example.invalid' } }).user).toBeUndefined()
  })
  it('scrubs embedded credentials, photos and home directories in technical errors', () => {
    const event: ErrorEvent = { type: undefined, message: 'Error password=synthetic-value with private-photo.jpg at C:\\Users\\Person\\app.ts' }
    expect(sanitizeSentryEvent(event).message).toBe('Error [Filtered credential] with [Filtered photo] at [Filtered home]\\app.ts')
  })
  it('does not leak free-form names in photo server errors and keeps the exception/frame', () => {
    const event: ErrorEvent = { type: undefined, tags: { area: 'cleaning-photo', action: 'reserveCleaningPhoto' },
      exception: { values: [{ type: 'Error', value: 'Could not upload for Synthetic Person', stacktrace: { frames: [{ function: 'reserveImpl', lineno: 3 }] } }] } }
    const result = sanitizeSentryEvent(event)
    expect(result.exception?.values?.[0]).toMatchObject({ type: 'Error', value: 'Cleaning photo failure: photo_action_failed', stacktrace: { frames: [{ function: 'reserveImpl', lineno: 3 }] } })
    expect(JSON.stringify(result)).not.toContain('Synthetic Person')
  })
})
