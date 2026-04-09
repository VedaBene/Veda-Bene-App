'use client'

import { useState, useTransition } from 'react'
import { fetchReceivableData, type ReceivableRow } from '@/app/(app)/statements/actions'
import { exportReceivablePDF } from '@/lib/utils/export-pdf'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Download, FileText, Filter, Receipt } from 'lucide-react'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const inputCls =
  'px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none'

type ClientTypeFilter = 'all' | 'rental' | 'particular'

const CLIENT_TYPE_OPTIONS: { value: ClientTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'rental', label: 'B2B (Agências)' },
  { value: 'particular', label: 'B2C (Particulares)' },
]

export function ReceivableStatement({ initial }: { initial: ReceivableRow[] }) {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [clientType, setClientType] = useState<ClientTypeFilter>('all')
  const [data, setData] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFilter() {
    setError(null)
    startTransition(async () => {
      try {
        const rows = await fetchReceivableData(
          startDate,
          endDate,
          clientType === 'all' ? undefined : clientType,
        )
        setData(rows)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao buscar dados')
      }
    })
  }

  function handleCSV() {
    const params = new URLSearchParams({ start: startDate, end: endDate })
    if (clientType !== 'all') params.set('client_type', clientType)
    window.open(`/api/export/receivable?${params}`, '_blank')
  }

  function handlePDF() {
    exportReceivablePDF(data, startDate, endDate)
  }

  const total = data.reduce((sum, r) => sum + r.total_value, 0)

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">De</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Até</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Tipo de Cliente</label>
            <select value={clientType} onChange={e => setClientType(e.target.value as ClientTypeFilter)} className={inputCls}>
              {CLIENT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={handleFilter} isLoading={isPending} variant="accent" icon={<Filter size={16} />}>
            {isPending ? 'Buscando…' : 'Filtrar'}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={handleCSV} variant="ghost" size="sm" icon={<Download size={14} />}>
              CSV
            </Button>
            <Button type="button" onClick={handlePDF} variant="ghost" size="sm" icon={<FileText size={14} />}>
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="text-sm text-danger bg-danger-bg px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Imóvel</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total OS</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Receipt size={20} className="text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Nenhum dado encontrado para o período.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map(r => (
                  <tr key={r.property_id} className="transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.client_name}</td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={r.client_type === 'rental' ? 'info' : 'default'}
                        label={r.client_type === 'rental' ? 'B2B' : 'B2C'}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-foreground/70">{r.property_name}</td>
                    <td className="px-5 py-3.5 text-right text-foreground/70">{r.os_count}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-foreground">
                      € {r.total_value.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-accent/5">
                  <td colSpan={4} className="px-5 py-3.5 font-bold text-foreground">
                    Total Geral
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-accent text-base">
                    € {total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}
