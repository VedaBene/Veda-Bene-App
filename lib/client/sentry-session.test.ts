import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { setUser } from '@sentry/nextjs'
import { clearSentrySession, observeSentrySession } from './sentry-session'
vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn() }))
const id = '12345678-1234-4123-8123-123456789abc'
let callback: (event: AuthChangeEvent, session: Session | null) => void
const unsubscribe = vi.fn()
const auth = { onAuthStateChange: vi.fn((cb: typeof callback) => {
  callback = cb
  return { data: { subscription: { unsubscribe } } }
}) } as unknown as SupabaseClient['auth']
function session(userId = id, seconds = 60): Session {
  return { user: { id: userId, email: 'synthetic@example.invalid', user_metadata: { name: 'Synthetic Person' } },
    expires_at: Math.floor(Date.now() / 1000) + seconds, access_token: 'synthetic-ignored' } as unknown as Session
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T12:00:00Z')) })
afterEach(() => vi.useRealTimers())
describe('Sentry session lifecycle', () => {
  it('sets only a pseudonymous UUID on initial session and clears it on logout', () => {
    const stop = observeSentrySession(auth)
    expect(setUser).toHaveBeenLastCalledWith(null)
    callback('INITIAL_SESSION', session())
    expect(setUser).toHaveBeenLastCalledWith({ id })
    callback('SIGNED_OUT', null)
    expect(setUser).toHaveBeenLastCalledWith(null)
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
  it('clears immediately when the local logout starts, before the Auth request settles', () => {
    observeSentrySession(auth)
    callback('SIGNED_IN', session())
    clearSentrySession()
    expect(setUser).toHaveBeenLastCalledWith(null)
  })
  it('does not block logout or Auth callbacks when telemetry is unavailable', () => {
    vi.mocked(setUser).mockImplementationOnce(() => { throw new Error('synthetic telemetry failure') })
    expect(clearSentrySession).not.toThrow()
    observeSentrySession(auth)
    vi.mocked(setUser).mockImplementationOnce(() => { throw new Error('synthetic telemetry failure') })
    expect(() => callback('SIGNED_IN', session())).not.toThrow()
  })
  it('clears expired or missing sessions without waiting for another Auth event', () => {
    observeSentrySession(auth)
    callback('INITIAL_SESSION', session())
    vi.advanceTimersByTime(60000)
    expect(setUser).toHaveBeenLastCalledWith(null)
    callback('TOKEN_REFRESHED', session(id, -1))
    expect(setUser).toHaveBeenLastCalledWith(null)
    callback('INITIAL_SESSION', null)
    expect(setUser).toHaveBeenLastCalledWith(null)
  })
  it('cancels the old expiry timer on refresh or account switch', () => {
    observeSentrySession(auth)
    callback('INITIAL_SESSION', session(id, 10))
    const next = 'abcdef12-1234-4123-8123-123456789abc'
    callback('SIGNED_IN', session(next, 60))
    vi.advanceTimersByTime(10000)
    expect(setUser).toHaveBeenLastCalledWith({ id: next })
    callback('TOKEN_REFRESHED', session(next, 120))
    vi.advanceTimersByTime(50000)
    expect(setUser).toHaveBeenLastCalledWith({ id: next })
  })
  it('unsubscribes, cancels timers and ignores stale callbacks after unmount', () => {
    const stop = observeSentrySession(auth)
    callback('INITIAL_SESSION', session())
    stop()
    vi.mocked(setUser).mockClear()
    callback('SIGNED_IN', session())
    vi.advanceTimersByTime(120000)
    expect(setUser).not.toHaveBeenCalled()
  })
})
