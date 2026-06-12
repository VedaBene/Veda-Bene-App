import 'server-only'

import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const LOGIN_LOCKOUT_MAX_FAILURES = 4
export const LOGIN_LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000

export type LoginAttemptRecord = {
  email_key: string
  ip_key: string
  failed_count: number
  locked_until: string | null
  last_failed_at: string | null
}

type LoginAttemptUpdate = {
  email_key: string
  ip_key: string
  failed_count: number
  locked_until: string | null
  last_failed_at: string
  updated_at: string
}

type LoginAttemptStore = {
  get(emailKey: string, ipKey: string): Promise<LoginAttemptRecord | null>
  upsert(update: LoginAttemptUpdate): Promise<void>
  clear(emailKey: string, ipKey: string): Promise<void>
}

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || headers.get('x-real-ip')?.trim() || 'unknown'
}

export function createLoginLockoutKey(value: string, secret: string) {
  if (!secret) {
    throw new Error('LOGIN_LOCKOUT_SECRET is required')
  }

  return createHmac('sha256', secret).update(value).digest('hex')
}

export function isLoginLocked(record: LoginAttemptRecord | null, now = new Date()) {
  if (!record?.locked_until) return false

  return new Date(record.locked_until).getTime() > now.getTime()
}

export function getFailedLoginUpdate(
  emailKey: string,
  ipKey: string,
  record: LoginAttemptRecord | null,
  now = new Date()
): LoginAttemptUpdate {
  const failedCount = (record?.failed_count ?? 0) + 1
  const shouldLock = failedCount >= LOGIN_LOCKOUT_MAX_FAILURES
  const timestamp = now.toISOString()

  return {
    email_key: emailKey,
    ip_key: ipKey,
    failed_count: failedCount,
    locked_until: shouldLock
      ? new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS).toISOString()
      : null,
    last_failed_at: timestamp,
    updated_at: timestamp,
  }
}

function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function createLoginAttemptStore(): LoginAttemptStore {
  const supabase = createServiceRoleClient()

  return {
    async get(emailKey, ipKey) {
      const { data, error } = await supabase
        .from('auth_login_attempts')
        .select('email_key, ip_key, failed_count, locked_until, last_failed_at')
        .eq('email_key', emailKey)
        .eq('ip_key', ipKey)
        .maybeSingle()

      if (error) throw error

      return data as LoginAttemptRecord | null
    },
    async upsert(update) {
      const { error } = await supabase
        .from('auth_login_attempts')
        .upsert(update, { onConflict: 'email_key,ip_key' })

      if (error) throw error
    },
    async clear(emailKey, ipKey) {
      const { error } = await supabase
        .from('auth_login_attempts')
        .delete()
        .eq('email_key', emailKey)
        .eq('ip_key', ipKey)

      if (error) throw error
    },
  }
}

export function getLoginLockoutIdentity(email: string, headers: Headers) {
  const secret = process.env.LOGIN_LOCKOUT_SECRET

  if (!secret) {
    throw new Error('LOGIN_LOCKOUT_SECRET is required')
  }

  const normalizedEmail = normalizeLoginEmail(email)
  const ip = getClientIp(headers)

  return {
    normalizedEmail,
    emailKey: createLoginLockoutKey(normalizedEmail, secret),
    ipKey: createLoginLockoutKey(ip, secret),
  }
}

export async function isLoginAttemptBlocked(emailKey: string, ipKey: string) {
  const store = createLoginAttemptStore()
  const record = await store.get(emailKey, ipKey)

  return isLoginLocked(record)
}

export async function recordFailedLogin(emailKey: string, ipKey: string) {
  const store = createLoginAttemptStore()
  const record = await store.get(emailKey, ipKey)
  const update = getFailedLoginUpdate(emailKey, ipKey, record)

  await store.upsert(update)
}

export async function clearFailedLogin(emailKey: string, ipKey: string) {
  const store = createLoginAttemptStore()
  await store.clear(emailKey, ipKey)
}
