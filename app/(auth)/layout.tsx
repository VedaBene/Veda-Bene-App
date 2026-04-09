import { Sparkles } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Branded Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={20} className="text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">Veda Bene</span>
            </div>
            <p className="text-sm text-white/50 font-medium">Servizi di pulizia</p>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Gestione completa<br />
              dei tuoi immobili
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-sm">
              Ordini di servizio, immobili, dipendenti e finanze — tutto in un unico posto.
            </p>
            <div className="flex gap-8 pt-4 border-t border-white/10">
              <div>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-xs text-white/50 mt-0.5">Digitale</p>
              </div>
              <div>
                <p className="text-2xl font-bold">Roma</p>
                <p className="text-xs text-white/50 mt-0.5">Short-term rentals</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/30">© {new Date().getFullYear()} Veda Bene</p>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles size={18} className="text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-primary tracking-tight">Veda Bene</span>
            </div>
            <p className="text-sm text-muted-foreground">Servizi di pulizia</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
