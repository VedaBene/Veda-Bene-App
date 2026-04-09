'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthStat } from '@/app/(app)/dashboard/actions'
import { Users } from 'lucide-react'

type Props = {
  data: MonthStat[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg shadow-elevated px-3 py-2">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-bold text-foreground">€ {payload[0].value.toFixed(2)}</p>
    </div>
  )
}

export function StaffCostChart({ data }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <Users size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Custo funcionários — últimos 3 meses</h2>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `€${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
          <Bar dataKey="value" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
