'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  SESSION_ACTIVITY_STORAGE_KEY,
  clearSessionActivity,
  getSessionTimeoutState,
  readStoredSessionActivity,
  recordSessionActivity,
} from '@/lib/session-timeout'
import { createClient } from '@/utils/supabase/client'

const ACTIVITY_THROTTLE_MS = 15 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const timeoutIdRef = useRef<number | null>(null)
  const lastRecordedActivityRef = useRef(0)
  const isLoggingOutRef = useRef(false)

  const clearLogoutTimer = useCallback(() => {
    if (timeoutIdRef.current === null) return

    window.clearTimeout(timeoutIdRef.current)
    timeoutIdRef.current = null
  }, [])

  const expireSession = useCallback(async () => {
    if (isLoggingOutRef.current) return

    isLoggingOutRef.current = true
    clearLogoutTimer()
    clearSessionActivity()

    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })

    router.replace('/login?auth_error=session_expired')
    router.refresh()
  }, [clearLogoutTimer, router])

  const scheduleLogout = useCallback(() => {
    clearLogoutTimer()

    const state = getSessionTimeoutState(readStoredSessionActivity())

    if (state.isExpired) {
      void expireSession()
      return
    }

    timeoutIdRef.current = window.setTimeout(() => {
      void expireSession()
    }, state.remainingMs)
  }, [clearLogoutTimer, expireSession])

  const recordActivity = useCallback(() => {
    if (isLoggingOutRef.current) return

    const now = Date.now()
    const state = getSessionTimeoutState(readStoredSessionActivity(), now)

    if (state.isExpired) {
      void expireSession()
      return
    }

    if (now - lastRecordedActivityRef.current < ACTIVITY_THROTTLE_MS) {
      return
    }

    lastRecordedActivityRef.current = now
    recordSessionActivity(now)
    scheduleLogout()
  }, [expireSession, scheduleLogout])

  useEffect(() => {
    const state = getSessionTimeoutState(readStoredSessionActivity())

    if (state.isExpired) {
      void expireSession()
      return
    }

    lastRecordedActivityRef.current = state.lastActivity ?? 0
    scheduleLogout()

    const listenerOptions = { passive: true } as const
    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, recordActivity, listenerOptions)
    })
    document.addEventListener('scroll', recordActivity, { passive: true, capture: true })

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        scheduleLogout()
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== SESSION_ACTIVITY_STORAGE_KEY) return

      if (!event.newValue) {
        void expireSession()
        return
      }

      const nextState = getSessionTimeoutState(event.newValue)

      if (nextState.isExpired) {
        void expireSession()
        return
      }

      lastRecordedActivityRef.current = nextState.lastActivity ?? 0
      scheduleLogout()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      clearLogoutTimer()
      ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, recordActivity)
      })
      document.removeEventListener('scroll', recordActivity, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [clearLogoutTimer, expireSession, recordActivity, scheduleLogout])

  return children
}
