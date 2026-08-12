import { Badge } from '@/components/ui/Badge'
import type { OSStatus } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { toRomeIsoString } from '@/lib/timezone'

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
    timeZone: 'Europe/Rome',
  })
}

export type CompactRomeDateTimeParts = {
  calendarDate: string
  calendarDayKey: string
  time: string
}

export function getCompactRomeDateTimeParts(
  value: string | null | undefined,
): CompactRomeDateTimeParts | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const time = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(date)
  const calendarDate = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(date)
  const calendarDayKey = new Intl.DateTimeFormat('fr-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(date)

  return { calendarDate, calendarDayKey, time }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export function formatStaffName(fullName: string | null | undefined) {
  return fullName || '—'
}

export function formatStaffNames(staff: readonly { full_name: string }[] | null | undefined) {
  return staff?.map(({ full_name }) => full_name).join(', ') || '—'
}

export function hoursUntil(checkout: string, checkin: string): number | null {
  const checkoutIso = toRomeIsoString(checkout)
  const checkinIso = toRomeIsoString(checkin)
  if (!checkoutIso || !checkinIso) return null

  const co = new Date(checkoutIso)
  const ci = new Date(checkinIso)
  if (isNaN(co.getTime()) || isNaN(ci.getTime())) return null
  return (ci.getTime() - co.getTime()) / 3600000
}

export function isUrgentCleaningWindow(checkout: string, checkin: string): boolean {
  const hours = hoursUntil(checkout, checkin)
  return hours !== null && hours > 0 && hours <= 3
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
