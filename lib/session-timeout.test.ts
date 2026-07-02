import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_ACTIVITY_COOKIE,
  SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_TIMEOUT_MS,
  clearSessionActivity,
  createSessionActivityValue,
  getSessionTimeoutState,
  isSessionActivityExpired,
  parseSessionActivityValue,
  recordSessionActivity,
} from './session-timeout'

describe('session timeout helpers', () => {
  const now = 1_700_000_000_000

  it('keeps a recent timestamp active', () => {
    const state = getSessionTimeoutState(String(now - 1_000), now)

    expect(state).toEqual({
      lastActivity: now - 1_000,
      isExpired: false,
      remainingMs: SESSION_TIMEOUT_MS - 1_000,
    })
  })

  it('expires a timestamp older than 45 minutes', () => {
    const value = String(now - SESSION_TIMEOUT_MS - 1)

    expect(isSessionActivityExpired(value, now)).toBe(true)
  })

  it('treats missing and invalid values as expired, and future values as active', () => {
    expect(isSessionActivityExpired(null, now)).toBe(true)
    expect(isSessionActivityExpired('', now)).toBe(true)
    expect(isSessionActivityExpired('not-a-number', now)).toBe(true)
    expect(isSessionActivityExpired(String(now + 1), now)).toBe(false)
  })

  it('creates and parses timestamp values', () => {
    const value = createSessionActivityValue(now + 0.9)

    expect(value).toBe(String(now))
    expect(parseSessionActivityValue(value)).toBe(now)
  })

  it('writes and clears browser activity markers', () => {
    const setItem = vi.fn()
    const removeItem = vi.fn()
    const cookieValues: string[] = []
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          setItem,
          removeItem,
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get cookie() {
          return ''
        },
        set cookie(value: string) {
          cookieValues.push(value)
        },
      },
    })

    try {
      expect(recordSessionActivity(now)).toBe(String(now))
      clearSessionActivity()
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }

    expect(setItem).toHaveBeenCalledWith(SESSION_ACTIVITY_STORAGE_KEY, String(now))
    expect(removeItem).toHaveBeenCalledWith(SESSION_ACTIVITY_STORAGE_KEY)
    expect(cookieValues[0]).toContain(`${SESSION_ACTIVITY_COOKIE}=${now}`)
    expect(cookieValues[0]).toContain(`Max-Age=${SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS}`)
    expect(cookieValues[1]).toContain(`${SESSION_ACTIVITY_COOKIE}=`)
    expect(cookieValues[1]).toContain('Max-Age=0')
  })
})
