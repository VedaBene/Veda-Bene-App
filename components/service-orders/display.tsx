import { Badge } from '@/components/ui/Badge'
import type { OSStatus } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'

export const STATUS_LABEL: Record<OSStatus, string> = {
  open: 'Aperto',
  in_progress: 'In corso',
  done: 'Completato',
}

export const STATUS_VARIANT: Record<OSStatus, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export function hoursUntil(checkout: string, checkin: string): number | null {
  const co = new Date(checkout)
  const ci = new Date(checkin)
  if (isNaN(co.getTime()) || isNaN(ci.getTime())) return null
  return (ci.getTime() - co.getTime()) / 3600000
}

export function ServiceOrderStatusBadge({ status }: { status: OSStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? 'default'}
      label={STATUS_LABEL[status] ?? status}
      dot
    />
  )
}

export function PricingModeBadge({ mode }: { mode: ServiceOrderListItem['pricing_mode'] }) {
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
