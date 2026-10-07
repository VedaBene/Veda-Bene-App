import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { setUser } from '@sentry/nextjs'
import { Sidebar } from '@/components/layout/Sidebar'
import { SessionTimeoutProvider } from './SessionTimeoutProvider'
import { SentrySessionProvider } from './SentrySessionProvider'

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  expired: false, effects: [] as (() => void | (() => void))[], onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn() }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useCallback: (fn: unknown) => fn, useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect) },
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/service-orders', useRouter: () => mocks }))
vi.mock('@/lib/hooks/useRole', () => ({ useRole: () => ({ role: 'limpeza' }) }))
vi.mock('@/utils/supabase/client', () => ({ createClient: () => ({ auth: { signOut: mocks.signOut, onAuthStateChange: mocks.onAuthStateChange } }) }))
vi.mock('@/lib/session-timeout', () => ({
  clearSessionActivity: vi.fn(), readStoredSessionActivity: () => null,
  getSessionTimeoutState: () => ({ isExpired: mocks.expired, remainingMs: 60000 }), recordSessionActivity: vi.fn(),
}))

function logoutButton(node: ReactNode): (() => Promise<void>) | undefined {
  if (Array.isArray(node)) return node.map(logoutButton).find(Boolean)
  if (!isValidElement<{ children?: ReactNode; onClick?: () => Promise<void>; className?: string }>(node)) return
  if (node.type === 'button' && node.props.className?.includes('text-danger/80')) return node.props.onClick
  return logoutButton(node.props.children)
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.effects = []; mocks.expired = false
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } })
  vi.stubGlobal('window', { clearTimeout, setTimeout })
})
afterEach(() => vi.unstubAllGlobals())
describe('actual logout and expiry handlers', () => {
  it('clears the Sentry identity before manual signOut settles, even on Auth failure', async () => {
    let finish!: () => void
    mocks.signOut.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ error: new Error('synthetic auth failure') }) }))
    const handler = logoutButton(Sidebar({ isOpen: true, setIsOpen: vi.fn() }))!
    const loggingOut = handler()
    expect(setUser).toHaveBeenLastCalledWith(null)
    expect(vi.mocked(setUser).mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0])
    expect(mocks.push).not.toHaveBeenCalled()
    finish(); await loggingOut
    expect(mocks.push).toHaveBeenCalledWith('/login')
  })
  it('clears identity when inactivity expires, before awaiting Auth', async () => {
    mocks.expired = true
    SessionTimeoutProvider({ children: null })
    mocks.effects[0]()
    expect(setUser).toHaveBeenLastCalledWith(null)
    expect(vi.mocked(setUser).mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0])
    await Promise.resolve()
    expect(mocks.replace).toHaveBeenCalledWith('/login?auth_error=session_expired')
  })
  it('root provider observes Auth and clears/unsubscribes on teardown and remount', () => {
    SentrySessionProvider({ children: null })
    const cleanup = mocks.effects[0]() as () => void
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce()
    cleanup()
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
    expect(setUser).toHaveBeenLastCalledWith(null)
    const secondCleanup = mocks.effects[0]() as () => void
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(2)
    secondCleanup()
  })
})
