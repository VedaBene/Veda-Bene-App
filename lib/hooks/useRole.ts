'use client'

import { useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { createClient } from '@/utils/supabase/client'
import type { Role, JwtWithRole } from '@/lib/types/database'

export function useRole() {
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchRole() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (token) {
        const payload = jwtDecode<JwtWithRole>(token)
        setRole(payload.app_role ?? null)
      } else {
        setRole(null)
      }
      setIsLoading(false)
    }

    fetchRole()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token
      if (token) {
        const payload = jwtDecode<JwtWithRole>(token)
        setRole(payload.app_role ?? null)
      } else {
        setRole(null)
      }
      setIsLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { role, isLoading }
}
