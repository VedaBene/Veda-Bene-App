'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const normalizedEmail = email.trim().toLowerCase()
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      const isRateLimited = error.status === 429 || error.message.toLowerCase().includes('rate limit')
      setError(
        isRateLimited
          ? 'Limite de envio de emails atingido. Aguarde alguns minutos antes de tentar novamente.'
          : 'Erro ao enviar o email. Tente novamente.',
      )
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setIsLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Mail size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Recupera password</h2>
            <p className="text-xs text-muted-foreground">Inserisci la tua email per reimpostare la password</p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-3 rounded-lg">
              <CheckCircle size={16} className="shrink-0" />
              Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
            </div>
            <div className="text-center">
              <Link href="/login" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={14} />
                Torna al login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              leftIcon={<Mail size={16} />}
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
              {isLoading ? 'Inviando…' : 'Invia link di recupero'}
            </Button>

            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={14} />
                Torna al login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
