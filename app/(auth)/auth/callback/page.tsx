'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { getAuthErrorFromUrl } from '@/utils/supabase/auth-errors'

function getCallbackType() {
  if (typeof window === 'undefined') return null

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return searchParams.get('type') ?? hashParams.get('type')
}

function getLoginErrorUrl(code: string) {
  return `/login?auth_error=${encodeURIComponent(code)}`
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function finishAuth() {
      const authError = getAuthErrorFromUrl(window.location.search, window.location.hash)

      if (authError) {
        router.replace(getLoginErrorUrl(authError.code))
        return
      }

      const supabase = createClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        router.replace(getLoginErrorUrl('callback_failed'))
        return
      }

      if (!session) {
        router.replace(getLoginErrorUrl('session_missing'))
        return
      }

      const type = getCallbackType()
      router.replace(!type || type === 'invite' || type === 'recovery' ? '/update-password' : '/service-orders')
    }

    finishAuth().catch(() => {
      if (isMounted) setError('Não foi possível validar o link de acesso. Solicite um novo link e tente novamente.')
    })

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            {error ? (
              <AlertCircle size={18} className="text-danger" />
            ) : (
              <Loader2 size={18} className="text-accent animate-spin" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {error ? 'Link inválido' : 'Validando acesso'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {error ?? 'Aguarde enquanto finalizamos a autenticação.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
