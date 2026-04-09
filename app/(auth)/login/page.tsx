'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Lock, AlertCircle, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Lock size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Accedi</h2>
            <p className="text-xs text-muted-foreground">Inserisci le tue credenziali</p>
          </div>
        </div>

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

          <Input
            label="Password"
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
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
            {isLoading ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>
      </div>
    </div>
  )
}
