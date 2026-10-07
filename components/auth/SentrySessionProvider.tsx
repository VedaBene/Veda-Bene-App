'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { observeSentrySession } from '@/lib/client/sentry-session'

export function SentrySessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => observeSentrySession(createClient().auth), [])
  return children
}
