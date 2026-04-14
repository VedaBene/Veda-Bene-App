'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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
      setError(error.message)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
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

        {success ? (
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-3 rounded-lg">
            <CheckCircle size={16} className="shrink-0" />
            Password definita con successo! Reindirizzamento…
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
