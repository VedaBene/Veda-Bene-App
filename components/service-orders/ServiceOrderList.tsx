'use client'

import Link from 'next/link'
import { UrgencyBadge } from './UrgencyBadge'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ClipboardList } from 'lucide-react'
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
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
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
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {os.property?.name ?? '—'}
                  </span>
                  <UrgencyBadge isUrgent={os.is_urgent} />
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
  return (
    <div className="space-y-5">
      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Em Aberto</h2>
          {active.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning-bg text-warning text-[11px] font-bold">
              {active.length}
            </span>
          )}
        </div>
        <OSTable orders={active} role={role} emptyText="Nenhuma OS em aberto." />
      </Card>

      <Card>
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">Finalizadas</h2>
          {done.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-success-bg text-success text-[11px] font-bold">
              {done.length}
            </span>
          )}
        </div>
        <OSTable orders={done} role={role} emptyText="Nenhuma OS finalizada." />
      </Card>
    </div>
  )
}
