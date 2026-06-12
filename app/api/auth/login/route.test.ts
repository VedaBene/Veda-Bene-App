import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  isLoginAttemptBlocked: vi.fn(),
  recordFailedLogin: vi.fn(),
  clearFailedLogin: vi.fn(),
  getLoginLockoutIdentity: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  })),
}))

vi.mock('@/lib/server/auth/login-lockout', () => ({
  clearFailedLogin: mocks.clearFailedLogin,
  getLoginLockoutIdentity: mocks.getLoginLockoutIdentity,
  isLoginAttemptBlocked: mocks.isLoginAttemptBlocked,
  recordFailedLogin: mocks.recordFailedLogin,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

function loginRequest(body: unknown, init?: RequestInit) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLoginLockoutIdentity.mockReturnValue({
      normalizedEmail: 'user@example.com',
      emailKey: 'email-key',
      ipKey: 'ip-key',
    })
    mocks.isLoginAttemptBlocked.mockResolvedValue(false)
    mocks.signInWithPassword.mockResolvedValue({ error: null })
  })

  it('rejects invalid payloads', async () => {
    const response = await POST(loginRequest({ email: 'invalid', password: '' }))

    expect(response.status).toBe(400)
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('rejects invalid origins', async () => {
    const response = await POST(loginRequest(
      { email: 'user@example.com', password: 'secret' },
      { headers: { origin: 'https://evil.example' } },
    ))

    expect(response.status).toBe(403)
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('does not call Supabase Auth when login is locked', async () => {
    mocks.isLoginAttemptBlocked.mockResolvedValue(true)

    const response = await POST(loginRequest({ email: 'user@example.com', password: 'secret' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ success: false, error: 'Email ou senha incorretos.' })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('records a failed login after Supabase rejects credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('invalid') })

    const response = await POST(loginRequest({ email: 'user@example.com', password: 'wrong' }))

    expect(response.status).toBe(401)
    expect(mocks.recordFailedLogin).toHaveBeenCalledWith('email-key', 'ip-key')
    expect(mocks.clearFailedLogin).not.toHaveBeenCalled()
  })

  it('clears failures and returns success after login succeeds', async () => {
    const response = await POST(loginRequest({ email: 'user@example.com', password: 'secret' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    })
    expect(mocks.clearFailedLogin).toHaveBeenCalledWith('email-key', 'ip-key')
  })
})
