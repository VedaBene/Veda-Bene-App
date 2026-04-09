import type { TopProperty } from '@/app/(app)/dashboard/actions'
import { Trophy } from 'lucide-react'

type Props = {
  topMonth: TopProperty[]
  topYear: TopProperty[]
}

export function TopPropertiesTable({ topMonth, topYear }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <RankingTable title="Top 5 — Este mês" rows={topMonth} />
      <RankingTable title="Top 5 — Este ano" rows={topYear} />
    </div>
  )
}

const rankColors = [
  'bg-amber-100 text-amber-700 border border-amber-200',    // gold
  'bg-slate-100 text-slate-600 border border-slate-200',     // silver
  'bg-orange-100 text-orange-700 border border-orange-200',  // bronze
]

function RankingTable({ title, rows }: { title: string; rows: TopProperty[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2.5">
        <Trophy size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex-1 p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-5 py-3 font-semibold w-14">#</th>
              <th className="text-left px-5 py-3 font-semibold">Imóvel</th>
              <th className="text-right px-5 py-3 font-semibold">OSs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground/60 text-sm font-medium">
                  Sem dados no período.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.property_id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      i < 3 ? rankColors[i] : 'text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground font-medium whitespace-nowrap">{row.property_name}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold">
                      {row.os_count}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
