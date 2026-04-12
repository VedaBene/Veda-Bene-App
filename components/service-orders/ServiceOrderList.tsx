'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UrgencyBadge } from './UrgencyBadge'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ClipboardList, Search, FileDown, X } from 'lucide-react'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type OSWithRelations = ServiceOrder & {
  property: Pick<Property, 'id' | 'name'> | null
  cleaning_staff: Pick<Profile, 'id' | 'full_name'> | null
  consegna_staff: Pick<Profile, 'id' | 'full_name'> | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
}

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

const OCCUPANCY_FIELDS: { key: keyof OSWithRelations; label: string }[] = [
  { key: 'real_guests', label: 'Hóspedes' },
  { key: 'double_beds', label: 'Camas Casal' },
  { key: 'single_beds', label: 'Camas Solteiro' },
  { key: 'sofa_beds', label: 'Sofá-camas' },
  { key: 'bathrooms', label: 'Banheiros' },
  { key: 'bidets', label: 'Bidês' },
  { key: 'cribs', label: 'Berços' },
]

function generatePDF(orders: OSWithRelations[], date: string) {
  const dateLabel = date ? formatDate(date) : 'Todas as datas'
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'UTC' })

  const totals: Record<string, number> = {}
  for (const { key } of OCCUPANCY_FIELDS) {
    totals[key as string] = orders.reduce((sum, o) => sum + ((o[key] as number) ?? 0), 0)
  }
  const activeTotalFields = OCCUPANCY_FIELDS.filter(({ key }) => totals[key as string] > 0)

  const rows = orders.map((o) => `
    <tr>
      <td>#${o.order_number}</td>
      <td>${o.property?.name ?? '—'}</td>
      <td>${formatDateTime(o.checkout_at)}</td>
      <td>${formatDateTime(o.checkin_at)}</td>
      ${OCCUPANCY_FIELDS.map(({ key }) => {
        const val = (o[key] as number) ?? 0
        return `<td class="${val > 0 ? 'highlight' : 'dim'}">${val > 0 ? val : '—'}</td>`
      }).join('')}
    </tr>
  `).join('')

  const totalRows = activeTotalFields.map(({ key, label }) => `
    <tr>
      <td>${label}</td>
      <td class="highlight">${totals[key as string]}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ordens de Serviço — Veda Bene</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #ccc; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .highlight { font-weight: 700; color: #111; }
    .dim { color: #aaa; }
    h2 { font-size: 13px; margin-bottom: 8px; }
    .totals-table { max-width: 300px; }
    .totals-table td:first-child { color: #555; }
    .totals-table td:last-child { font-weight: 700; text-align: right; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Veda Bene — Ordens de Serviço em Aberto</h1>
  <p class="meta">Data: ${dateLabel} &nbsp;|&nbsp; Gerado em: ${now}</p>
  <table>
    <thead>
      <tr>
        <th>OS #</th>
        <th>Imóvel</th>
        <th>Checkout</th>
        <th>Checkin</th>
        ${OCCUPANCY_FIELDS.map(({ label }) => `<th>${label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="11" style="text-align:center;color:#999;padding:16px">Nenhuma OS encontrada</td></tr>'}
    </tbody>
  </table>
  ${activeTotalFields.length > 0 ? `
  <h2>Totais</h2>
  <table class="totals-table">
    <tbody>${totalRows}</tbody>
  </table>` : ''}
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

function OSTable({
  orders,
  role,
  emptyText,
}: {
  orders: OSWithRelations[]
  role: Role
  emptyText: string
}) {
  const isCliente = role === 'cliente'

  if (orders.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList size={20} className="text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">{emptyText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">OS #</th>
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Imóvel</th>
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checkout</th>
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checkin</th>
            {!isCliente && (
              <>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Limpeza</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Consegna</th>
              </>
            )}
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {orders.map((os) => (
            <tr
              key={os.id}
              className="transition-colors hover:bg-muted/30"
            >
              <td className="px-5 py-3.5 text-foreground/50 text-xs font-mono">
                #{os.order_number}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {os.property?.name ?? '—'}
                  </span>
                  <UrgencyBadge isUrgent={os.is_urgent && os.status !== 'done'} />
                </div>
              </td>
              <td className="px-5 py-3.5 text-foreground/70">{formatDate(os.cleaning_date)}</td>
              <td className="px-5 py-3.5 text-foreground/70">{formatDateTime(os.checkout_at)}</td>
              <td className="px-5 py-3.5 text-foreground/70">{formatDateTime(os.checkin_at)}</td>
              {!isCliente && (
                <>
                  <td className="px-5 py-3.5 text-foreground/70">
                    {os.cleaning_staff?.full_name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-foreground/70">
                    {os.consegna_staff?.full_name ?? '—'}
                  </td>
                </>
              )}
              <td className="px-5 py-3.5">
                <Badge
                  variant={STATUS_VARIANT[os.status] ?? 'default'}
                  label={STATUS_LABEL[os.status] ?? os.status}
                  dot
                />
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href={`/service-orders/${os.id}`}
                  className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ServiceOrderList({
  active,
  done,
  role,
}: {
  active: OSWithRelations[]
  done: OSWithRelations[]
  role: Role
}) {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')

  const filterOrder = (o: OSWithRelations) => {
    const matchName = !search || (o.property?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchDate = !date || o.cleaning_date === date
    return matchName && matchDate
  }

  const filteredActive = active.filter(filterOrder)
  const filteredDone = done.filter(filterOrder)
  const hasFilter = search !== '' || date !== ''

  return (
    <div className="space-y-5">
      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Buscar por imóvel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className="max-w-xs"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-[180px]"
        />
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setDate('') }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
            Limpar
          </button>
        )}
      </div>

      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Em Aberto</h2>
          {filteredActive.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning-bg text-warning text-[11px] font-bold">
              {filteredActive.length}
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => generatePDF(filteredActive, date)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border/60 hover:border-border hover:bg-muted/40"
            >
              <FileDown size={14} />
              PDF
            </button>
          </div>
        </div>
        <OSTable orders={filteredActive} role={role} emptyText="Nenhuma OS em aberto." />
      </Card>

      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Finalizadas</h2>
          {filteredDone.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-success-bg text-success text-[11px] font-bold">
              {filteredDone.length}
            </span>
          )}
        </div>
        <OSTable orders={filteredDone} role={role} emptyText="Nenhuma OS finalizada." />
      </Card>
    </div>
  )
}
