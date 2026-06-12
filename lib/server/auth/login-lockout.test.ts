import { describe, expect, it } from 'vitest'
import {
  LOGIN_LOCKOUT_DURATION_MS,
  LOGIN_LOCKOUT_MAX_FAILURES,
  createLoginLockoutKey,
  getClientIp,
  getFailedLoginUpdate,
  isLoginLocked,
  normalizeLoginEmail,
  type LoginAttemptRecord,
} from './login-lockout'

describe('login lockout helpers', () => {
  const now = new Date('2026-06-11T12:00:00.000Z')

  it('normalizes login emails', () => {
    expect(normalizeLoginEmail('  USER@Example.COM  ')).toBe('user@example.com')
  })

  it('derives stable HMAC keys without exposing raw values', () => {
    const key = createLoginLockoutKey('user@example.com', 'test-secret')

    expect(key).toHaveLength(64)
    expect(key).toBe(createLoginLockoutKey('user@example.com', 'test-secret'))
    expect(key).not.toContain('user@example.com')
  })

  it('reads the first forwarded IP when available', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 198.51.100.2',
      'x-real-ip': '198.51.100.3',
    })

    expect(getClientIp(headers)).toBe('203.0.113.10')
  })

  it('falls back to x-real-ip and unknown', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.3' }))).toBe('198.51.100.3')
    expect(getClientIp(new Headers())).toBe('unknown')
  })

  it('detects active and expired locks', () => {
    const activeRecord = {
      locked_until: new Date(now.getTime() + 1_000).toISOString(),
    } as LoginAttemptRecord
    const expiredRecord = {
      locked_until: new Date(now.getTime() - 1_000).toISOString(),
    } as LoginAttemptRecord

    expect(isLoginLocked(activeRecord, now)).toBe(true)
    expect(isLoginLocked(expiredRecord, now)).toBe(false)
    expect(isLoginLocked(null, now)).toBe(false)
  })

  it('increments failures without locking before the threshold', () => {
    const update = getFailedLoginUpdate(
      'email-key',
      'ip-key',
      { failed_count: LOGIN_LOCKOUT_MAX_FAILURES - 2 } as LoginAttemptRecord,
      now,
    )

    expect(update.failed_count).toBe(LOGIN_LOCKOUT_MAX_FAILURES - 1)
    expect(update.locked_until).toBeNull()
    expect(update.last_failed_at).toBe(now.toISOString())
  })

  it('locks for 24 hours when the fourth failure is reached', () => {
    const update = getFailedLoginUpdate(
      'email-key',
      'ip-key',
      { failed_count: LOGIN_LOCKOUT_MAX_FAILURES - 1 } as LoginAttemptRecord,
      now,
    )

    expect(update.failed_count).toBe(LOGIN_LOCKOUT_MAX_FAILURES)
    expect(update.locked_until).toBe(
      new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS).toISOString(),
    )
  })
})
