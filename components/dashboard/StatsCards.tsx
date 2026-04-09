import type { Role } from '@/lib/types/database'
import { Building2, Clock, Euro } from 'lucide-react'

type Props = {
  propertiesThisMonth: number
  hoursThisMonth: number
  revenueThisMonth: number
  role: Role
}

export function StatsCards({ propertiesThisMonth, hoursThisMonth, revenueThisMonth, role }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <Card
        label="Imóveis Atendidos"
        value={propertiesThisMonth.toString()}
        sub="este mês"
        icon={<Building2 size={22} className="text-accent" />}
        iconBg="bg-accent/10"
      />
      <Card
        label="Horas Trabalhadas"
        value={`${hoursThisMonth.toFixed(1)}h`}
        sub="este mês"
        icon={<Clock size={22} className="text-primary" />}
        iconBg="bg-primary/5"
      />
      {role === 'admin' && (
        <Card
          label="Receita do Mês"
          value={`€ ${revenueThisMonth.toFixed(2)}`}
          sub="OSs finalizadas"
          highlight
          icon={<Euro size={22} className="text-white/90" />}
          iconBg="bg-white/15"
        />
      )}
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  highlight = false,
  icon,
  iconBg = 'bg-muted',
}: {
  label: string
  value: string
  sub: string
  highlight?: boolean
  icon?: React.ReactNode
  iconBg?: string
}) {
  return (
    <div
      className={`rounded-2xl border p-6 transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5 ${highlight
          ? 'bg-gradient-to-br from-primary to-primary/85 border-primary/50 text-white shadow-elevated'
          : 'bg-card border-border text-foreground shadow-card'
        }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`text-xs font-semibold uppercase tracking-wider ${highlight ? 'text-white/60' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-xs mt-4 font-medium ${highlight ? 'text-white/40' : 'text-muted-foreground/60'}`}>
        {sub}
      </p>
    </div>
  )
}
