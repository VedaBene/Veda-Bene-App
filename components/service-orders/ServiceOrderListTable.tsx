'use client'

import Link from 'next/link'
import { ClipboardList, Flag, Play, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Role } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { LiveTimer, formatWorkedTime } from './LiveTimer'
import { UrgencyBadge } from './UrgencyBadge'
import { PricingModeBadge, ServiceOrderStatusBadge, formatDate, formatDateTime } from './display'

function isAssignedWorker(o: ServiceOrderListItem, role: Role, userId?: string): boolean {
  if (!userId) return false
  return role === 'limpeza' && o.cleaning_staff_id === userId
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

function WorkerActions({
  order,
  assigned,
  onStart,
  onFinish,
  compact = false,
}: {
  order: ServiceOrderListItem
  assigned: boolean
  onStart?: (o: ServiceOrderListItem) => void
  onFinish?: (o: ServiceOrderListItem) => void
  compact?: boolean
}) {
  if (assigned && order.status === 'open' && onStart) {
    return (
      <Button
        variant="accent"
        size="sm"
        icon={<Play size={compact ? 13 : 14} />}
        onClick={() => onStart(order)}
        className={compact ? '' : 'w-full'}
      >
        {compact ? 'Avvia' : 'Avvia Pulizia'}
      </Button>
    )
  }
  if (assigned && order.status === 'in_progress' && onFinish) {
    return (
      <Button
        variant="danger"
        size="sm"
        icon={<Flag size={compact ? 13 : 14} />}
        onClick={() => onFinish(order)}
        className={compact ? '' : 'w-full'}
      >
        {compact ? 'Completa' : 'Completa Pulizia'}
      </Button>
    )
  }
  return null
}

export function ServiceOrderListTable({
  orders,
  role,
  emptyText,
  userId,
  onStart,
  onFinish,
}: {
  orders: ServiceOrderListItem[]
  role: Role
  emptyText: string
  userId?: string
  onStart?: (o: ServiceOrderListItem) => void
  onFinish?: (o: ServiceOrderListItem) => void
}) {
  const isCliente = role === 'cliente'
  const isWorker = role === 'limpeza'

  if (orders.length === 0) {
    return <EmptyList text={emptyText} />
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-3 py-3 md:hidden">
        {orders.map((os) => {
          const assigned = isAssignedWorker(os, role, userId)
          return (
            <div key={os.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <Link href={`/service-orders/${os.id}`} className="block active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded-md shrink-0 font-medium">
                    #{os.order_number}
                  </span>
                  <ServiceOrderStatusBadge status={os.status} />
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
                      Pulizia
                    </span>
                    <span className="font-semibold text-foreground/80">{formatDate(os.cleaning_date)}</span>
                  </div>

                  {!isCliente && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Squadra
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
                      Check-out
                    </span>
                    <span className="font-medium">{formatDateTime(os.checkout_at)}</span>
                  </div>
                  <div className="col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                      Check-in
                    </span>
                    <span className="font-medium">{formatDateTime(os.checkin_at)}</span>
                  </div>

                  {!isCliente && os.status === 'in_progress' && os.started_at && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Tempo in corso
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Timer size={13} className="text-info" />
                        <LiveTimer startedAt={os.started_at} />
                      </div>
                    </div>
                  )}

                  {!isCliente && os.status === 'done' && os.worked_minutes != null && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 text-muted-foreground/60">
                        Tempo totale
                      </span>
                      <span className="font-semibold text-foreground/80">{formatWorkedTime(os.worked_minutes)}</span>
                    </div>
                  )}
                </div>
              </Link>

              {isWorker && assigned && (onStart || onFinish) && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <WorkerActions order={os} assigned={assigned} onStart={onStart} onFinish={onFinish} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">O.L. #</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Immobile</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Check-out</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Check-in</th>
              {!isCliente && (
                <>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pulizia</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Consegna</th>
                </>
              )}
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stato</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {orders.map((os) => {
              const assigned = isAssignedWorker(os, role, userId)
              return (
                <tr key={os.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3.5 text-foreground/50 text-xs font-mono">#{os.order_number}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{os.property?.name ?? '—'}</span>
                      <UrgencyBadge isUrgent={os.is_urgent && os.status !== 'done'} />
                      <PricingModeBadge mode={os.pricing_mode} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-foreground/70">{formatDate(os.cleaning_date)}</td>
                  <td className="px-5 py-3.5 text-foreground/70">{formatDateTime(os.checkout_at)}</td>
                  <td className="px-5 py-3.5 text-foreground/70">{formatDateTime(os.checkin_at)}</td>
                  {!isCliente && (
                    <>
                      <td className="px-5 py-3.5 text-foreground/70">{os.cleaning_staff?.full_name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-foreground/70">{os.consegna_staff?.full_name ?? '—'}</td>
                    </>
                  )}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ServiceOrderStatusBadge status={os.status} />
                      {!isCliente && os.status === 'in_progress' && os.started_at && (
                        <div className="flex items-center gap-1">
                          <Timer size={13} className="text-info" />
                          <LiveTimer startedAt={os.started_at} />
                        </div>
                      )}
                      {!isCliente && os.status === 'done' && os.worked_minutes != null && (
                        <span className="text-xs text-muted-foreground">{formatWorkedTime(os.worked_minutes)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isWorker && <WorkerActions order={os} assigned={assigned} onStart={onStart} onFinish={onFinish} compact />}
                      <Link href={`/service-orders/${os.id}`} className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
                        Vedi
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
