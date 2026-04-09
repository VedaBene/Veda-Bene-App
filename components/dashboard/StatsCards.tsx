import type { Role } from '@/lib/types/database'

type Props = {
  propertiesThisMonth: number
  hoursThisMonth: number
  revenueThisMonth: number
  role: Role
}

export function StatsCards({ propertiesThisMonth, hoursThisMonth, revenueThisMonth, role }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        label="Imóveis atendidos"
        value={propertiesThisMonth.toString()}
        sub="este mês"
      />
      <Card
        label="Horas trabalhadas"
        value={`${hoursThisMonth.toFixed(1)}h`}
        sub="este mês"
      />
      {role === 'admin' && (
        <Card
          label="Receita do mês"
          value={`€ ${revenueThisMonth.toFixed(2)}`}
          sub="OSs finalizadas"
          highlight
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
}: {
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        highlight
          ? 'bg-blue-600 border-blue-700 text-white'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      <p className={`text-sm font-medium ${highlight ? 'text-blue-100' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-blue-200' : 'text-gray-400'}`}>{sub}</p>
    </div>
  )
}
