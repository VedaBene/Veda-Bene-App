'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { startCleaning, finishCleaning } from '@/app/(app)/service-orders/actions'
import { LiveTimer, formatWorkedTime } from './LiveTimer'
import { UrgencyBadge } from './UrgencyBadge'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ClipboardList, Search, FileDown, X, Play, Flag, Timer } from 'lucide-react'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type OSWithRelations = ServiceOrder & {
  property: Pick<Property, 'id' | 'name' | 'avg_cleaning_hours'> | null
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

function PricingModeBadge({ mode }: { mode: OSWithRelations['pricing_mode'] }) {
  if (mode === 'ripasso') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent/10 text-accent">
        Ripasso
      </span>
    )
  }
  if (mode === 'out_long_stay') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-info/10 text-info">
        Out Long Stay
      </span>
    )
  }
  return null
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

function isAssignedWorker(o: OSWithRelations, role: Role, userId?: string): boolean {
  if (!userId) return false
  if (role === 'limpeza' && o.cleaning_staff_id === userId) return true
  if (role === 'consegna' && o.consegna_staff_id === userId) return true
  return false
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <ClipboardList size={20} className="text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{text}</p>
      </div>
    </div>
  )
}

function OSTable({
  orders,
  role,
  emptyText,
  userId,
  onStart,
  onFinish,
}: {
  orders: OSWithRelations[]
  role: Role
  emptyText: string
  userId?: string
  onStart?: (o: OSWithRelations) => void
  onFinish?: (o: OSWithRelations) => void
}) {
  const isCliente = role === 'cliente'
  const isWorker = role === 'limpeza' || role === 'consegna'

  if (orders.length === 0) {
    return <EmptyList text={emptyText} />
  }

  return (
    <>
      {/* Mobile View (Cards) */}
      <div className="flex flex-col gap-3 px-3 py-3 md:hidden">
        {orders.map((os) => {
          const assigned = isAssignedWorker(os, role, userId)
          return (
            <div
              key={os.id}
              className="bg-card rounded-xl border border-border p-4 shadow-sm"
            >
              <Link
                href={`/service-orders/${os.id}`}
                className="block active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded-md shrink-0 font-medium">
                    #{os.order_number}
                  </span>
                  <Badge
                    variant={STATUS_VARIANT[os.status] ?? 'default'}
                    label={STATUS_LABEL[os.status] ?? os.status}
                    dot
                  />
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h3 className="font-bold text-primary/90 text-[15px] leading-tight line-clamp-1">
                    {os.property?.name ?? '—'}
                  </h3>
                  <UrgencyBadge isUrgent={os.is_urgent && os.status !== 'done'} />
                  <PricingModeBadge mode={os.pricing_mode} />
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                      Limpeza
                    </span>
                    <span className="font-semibold text-foreground/80">{formatDate(os.cleaning_date)}</span>
                  </div>

                  {!isCliente && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Equipe
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate" title={os.cleaning_staff?.full_name ?? '—'}>
                          <span className="opacity-60 font-medium">L:</span> {os.cleaning_staff?.full_name?.split(' ')[0] ?? '—'}
                        </span>
                        <span className="truncate" title={os.consegna_staff?.full_name ?? '—'}>
                          <span className="opacity-60 font-medium">C:</span> {os.consegna_staff?.full_name?.split(' ')[0] ?? '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                      Checkout
                    </span>
                    <span className="font-medium">{formatDateTime(os.checkout_at)}</span>
                  </div>
                  <div className="col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                      Check-in
                    </span>
                    <span className="font-medium">{formatDateTime(os.checkin_at)}</span>
                  </div>

                  {os.status === 'in_progress' && os.started_at && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Tempo em execução
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Timer size={13} className="text-info" />
                        <LiveTimer startedAt={os.started_at} />
                      </div>
                    </div>
                  )}

                  {os.status === 'done' && os.worked_minutes != null && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Tempo total
                      </span>
                      <span className="font-semibold text-foreground/80">{formatWorkedTime(os.worked_minutes)}</span>
                    </div>
                  )}
                </div>
              </Link>

              {isWorker && assigned && os.status === 'open' && onStart && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="accent"
                    size="sm"
                    icon={<Play size={14} />}
                    onClick={() => onStart(os)}
                    className="w-full"
                  >
                    Iniciar Limpeza
                  </Button>
                </div>
              )}

              {isWorker && assigned && os.status === 'in_progress' && onFinish && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Flag size={14} />}
                    onClick={() => onFinish(os)}
                    className="w-full"
                  >
                    Finalizar Limpeza
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block overflow-x-auto">
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
            {orders.map((os) => {
              const assigned = isAssignedWorker(os, role, userId)
              return (
                <tr
                  key={os.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5 text-foreground/50 text-xs font-mono">
                    #{os.order_number}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {os.property?.name ?? '—'}
                      </span>
                      <UrgencyBadge isUrgent={os.is_urgent && os.status !== 'done'} />
                      <PricingModeBadge mode={os.pricing_mode} />
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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={STATUS_VARIANT[os.status] ?? 'default'}
                        label={STATUS_LABEL[os.status] ?? os.status}
                        dot
                      />
                      {os.status === 'in_progress' && os.started_at && (
                        <div className="flex items-center gap-1">
                          <Timer size={13} className="text-info" />
                          <LiveTimer startedAt={os.started_at} />
                        </div>
                      )}
                      {os.status === 'done' && os.worked_minutes != null && (
                        <span className="text-xs text-muted-foreground">
                          {formatWorkedTime(os.worked_minutes)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isWorker && assigned && os.status === 'open' && onStart && (
                        <Button
                          variant="accent"
                          size="sm"
                          icon={<Play size={13} />}
                          onClick={() => onStart(os)}
                        >
                          Iniciar
                        </Button>
                      )}
                      {isWorker && assigned && os.status === 'in_progress' && onFinish && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Flag size={13} />}
                          onClick={() => onFinish(os)}
                        >
                          Finalizar
                        </Button>
                      )}
                      <Link
                        href={`/service-orders/${os.id}`}
                        className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                      >
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function ServiceOrderList({
  active,
  done,
  role,
  userId,
}: {
  active: OSWithRelations[]
  done: OSWithRelations[]
  role: Role
  userId?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')

  const [startModalOrder, setStartModalOrder] = useState<OSWithRelations | null>(null)
  const [finishModalOrder, setFinishModalOrder] = useState<OSWithRelations | null>(null)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)

  const filterOrder = (o: OSWithRelations) => {
    const matchName = !search || (o.property?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchDate = !date || o.cleaning_date === date
    return matchName && matchDate
  }

  const allActive = active.filter(filterOrder)
  const inProgress = allActive.filter(o => o.status === 'in_progress')
  const open = allActive.filter(o => o.status === 'open')
  const filteredDone = done.filter(filterOrder)
  const hasFilter = search !== '' || date !== ''

  async function handleStartCleaning() {
    if (!startModalOrder) return
    setIsTrackingAction(true)
    try {
      const result = await startCleaning(startModalOrder.id)
      if (result?.error) {
        alert(result.error)
      } else {
        setStartModalOrder(null)
        startTransition(() => router.refresh())
      }
    } finally {
      setIsTrackingAction(false)
    }
  }

  async function handleFinishCleaning() {
    if (!finishModalOrder) return
    setIsTrackingAction(true)
    try {
      const result = await finishCleaning(finishModalOrder.id, finishNotes)
      if (result?.error) {
        alert(result.error)
      } else {
        setFinishModalOrder(null)
        setFinishNotes('')
        startTransition(() => router.refresh())
      }
    } finally {
      setIsTrackingAction(false)
    }
  }

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

      {/* Em Andamento */}
      {inProgress.length > 0 && (
        <Card>
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-foreground">Em Andamento</h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-info/10 text-info text-[11px] font-bold">
              {inProgress.length}
            </span>
          </div>
          <OSTable
            orders={inProgress}
            role={role}
            emptyText=""
            userId={userId}
            onFinish={setFinishModalOrder}
          />
        </Card>
      )}

      {/* Em Aberto */}
      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Em Aberto</h2>
          {open.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning-bg text-warning text-[11px] font-bold">
              {open.length}
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => generatePDF([...inProgress, ...open], date)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border/60 hover:border-border hover:bg-muted/40"
            >
              <FileDown size={14} />
              PDF
            </button>
          </div>
        </div>
        <OSTable
          orders={open}
          role={role}
          emptyText="Nenhuma OS em aberto."
          userId={userId}
          onStart={setStartModalOrder}
        />
      </Card>

      {/* Finalizadas */}
      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Finalizadas</h2>
          {filteredDone.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-success-bg text-success text-[11px] font-bold">
              {filteredDone.length}
            </span>
          )}
        </div>
        <OSTable
          orders={filteredDone}
          role={role}
          emptyText="Nenhuma OS finalizada."
          userId={userId}
        />
      </Card>

      {/* Modal: Iniciar Limpeza */}
      {startModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Iniciar Limpeza</h2>
              </div>
              <button type="button" onClick={() => setStartModalOrder(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">OS</p>
                <span className="text-xs font-mono text-muted-foreground">#{startModalOrder.order_number}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{startModalOrder.property?.name ?? '—'}</p>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Checkout</p>
                  <p className="text-xs font-medium text-foreground">{formatDateTime(startModalOrder.checkout_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Check-in</p>
                  <p className="text-xs font-medium text-foreground">
                    {startModalOrder.checkin_at ? formatDateTime(startModalOrder.checkin_at) : 'Sem check-in programado'}
                  </p>
                </div>
              </div>

              {startModalOrder.property?.avg_cleaning_hours != null && (
                <div className="pt-1 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Tempo estimado</p>
                  <p className="text-xs font-medium text-foreground">{startModalOrder.property.avg_cleaning_hours}h</p>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Ao confirmar, o horário de início será registrado e o status passará para <strong>Em andamento</strong>.
            </p>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setStartModalOrder(null)} className="flex-1">
                Cancelar
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleStartCleaning} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Finalizar Limpeza */}
      {finishModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Finalizar Limpeza</h2>
              </div>
              <button type="button" onClick={() => { setFinishModalOrder(null); setFinishNotes('') }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">OS</p>
                <span className="text-xs font-mono text-muted-foreground">#{finishModalOrder.order_number}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{finishModalOrder.property?.name ?? '—'}</p>
              {finishModalOrder.started_at && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                  <Timer size={13} className="text-info" />
                  <span className="text-xs text-muted-foreground">Tempo em execução:</span>
                  <LiveTimer startedAt={finishModalOrder.started_at} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Observações
              </label>
              <textarea
                value={finishNotes}
                onChange={e => setFinishNotes(e.target.value)}
                placeholder="Tudo OK, problemas encontrados, observações gerais…"
                rows={3}
                className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white resize-none transition-all focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              O horário de conclusão será registrado e o tempo total calculado automaticamente.
            </p>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => { setFinishModalOrder(null); setFinishNotes('') }} className="flex-1">
                Cancelar
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleFinishCleaning} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
