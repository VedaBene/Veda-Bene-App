import type { SupabaseClient } from '@supabase/supabase-js'
import { setUser } from '@sentry/nextjs'
import { pseudonymousSentryUser } from '@/lib/observability/sentry-privacy'

function setSentryIdentity(id?: string) {
  try { setUser(pseudonymousSentryUser(id)) } catch { /* Telemetry cannot interrupt Auth/logout. */ }
}
export function clearSentrySession() { setSentryIdentity() }

// Telemetry only: never use this session snapshot for authorization.
export function observeSentrySession(auth: SupabaseClient['auth']) {
  let active = true
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  clearSentrySession()
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!active) return
    clearTimeout(expiryTimer)
    const remaining = event === 'SIGNED_OUT' ? 0 : (session?.expires_at ?? 0) * 1000 - Date.now()
    setSentryIdentity(remaining > 0 ? session?.user.id : undefined)
    if (remaining > 0) expiryTimer = setTimeout(clearSentrySession, Math.min(remaining, 2_147_483_647))
  })
  return () => {
    active = false
    clearTimeout(expiryTimer)
    data.subscription.unsubscribe()
    clearSentrySession()
  }
}
