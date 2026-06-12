export const SESSION_TIMEOUT_MS = 45 * 60 * 1000
export const SESSION_ACTIVITY_COOKIE = 'veda_bene_last_activity'
export const SESSION_ACTIVITY_STORAGE_KEY = 'veda_bene_last_activity'
export const SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS = Math.ceil(SESSION_TIMEOUT_MS / 1000)

type SessionTimeoutState = {
  lastActivity: number | null
  isExpired: boolean
  remainingMs: number
}

export function createSessionActivityValue(now = Date.now()) {
  return String(Math.trunc(now))
}

export function parseSessionActivityValue(value: string | null | undefined) {
  if (!value) return null

  const timestamp = Number(value.trim())

  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return null
  }

  return timestamp
}

export function getSessionTimeoutState(
  value: string | null | undefined,
  now = Date.now()
): SessionTimeoutState {
  const lastActivity = parseSessionActivityValue(value)

  if (!lastActivity || lastActivity > now) {
    return { lastActivity: null, isExpired: true, remainingMs: 0 }
  }

  const remainingMs = SESSION_TIMEOUT_MS - (now - lastActivity)

  return {
    lastActivity,
    isExpired: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
  }
}

export function isSessionActivityExpired(value: string | null | undefined, now = Date.now()) {
  return getSessionTimeoutState(value, now).isExpired
}

function readActivityCookie() {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${SESSION_ACTIVITY_COOKIE}=`))

  if (!cookie) return null

  return decodeURIComponent(cookie.split('=').slice(1).join('='))
}

export function readStoredSessionActivity() {
  const cookieValue = readActivityCookie()
  if (cookieValue) return cookieValue

  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function recordSessionActivity(now = Date.now()) {
  const value = createSessionActivityValue(now)

  if (typeof document !== 'undefined') {
    document.cookie = [
      `${SESSION_ACTIVITY_COOKIE}=${encodeURIComponent(value)}`,
      `Max-Age=${SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS}`,
      'Path=/',
      'SameSite=Lax',
    ].join('; ')
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, value)
    } catch {
      // Cookie tracking still covers server-side enforcement.
    }
  }

  return value
}

export function clearSessionActivity() {
  if (typeof document !== 'undefined') {
    document.cookie = [
      `${SESSION_ACTIVITY_COOKIE}=`,
      'Max-Age=0',
      'Path=/',
      'SameSite=Lax',
    ].join('; ')
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY)
    } catch {
      // Nothing else to clear if storage is unavailable.
    }
  }
}
