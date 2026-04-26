'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getAuthErrorFromUrl } from '@/utils/supabase/auth-errors'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      const authError = getAuthErrorFromUrl(window.location.search, window.location.hash)

      if (authError) {
        setError(authError.message)
        setIsCheckingSession(false)
        window.history.replaceState(null, '', window.location.pathname)
        return
      }

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      setHasSession(Boolean(session))
      if (!session) {
        setError('Link inválido ou expirado. Solicite um novo link de acesso e tente novamente.')
      }
      setIsCheckingSession(false)
    }

    checkSession().catch(() => {
      if (!isMounted) return

      setError('Não foi possível validar sua sessão. Solicite um novo link e tente novamente.')
      setIsCheckingSession(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      const hasMissingSession = error.message.toLowerCase().includes('session')
      setError(
        hasMissingSession
          ? 'A sessão do link expirou. Solicite um novo link e tente novamente.'
          : error.message,
      )
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/service-orders'), 2000)
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Lock size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Crea la tua password</h2>
            <p className="text-xs text-muted-foreground">Scegli una password sicura per accedere</p>
          </div>
        </div>

        {isCheckingSession ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-3 rounded-lg">
            <Loader2 size={16} className="shrink-0 animate-spin" />
            Validando link de acesso…
          </div>
        ) : success ? (
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-3 rounded-lg">
            <CheckCircle size={16} className="shrink-0" />
            Password definita con successo! Reindirizzamento…
          </div>
        ) : !hasSession ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-danger bg-danger-bg px-4 py-3 rounded-lg">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
            <Link href="/forgot-password" className="text-sm text-accent hover:underline">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nova senha"
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              leftIcon={<Lock size={16} />}
            />

            <Input
              label="Confirmar senha"
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              leftIcon={<Lock size={16} />}
            />

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger-bg px-4 py-3 rounded-lg">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              isLoading={isLoading}
              variant="accent"
              className="w-full justify-center mt-2"
              size="lg"
            >
              {isLoading ? 'Salvando…' : 'Definir senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
