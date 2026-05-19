'use client'

import { useCallback, useEffect, useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Timer } from 'lucide-react'
import { finishCleaning, startCleaning } from '@/app/(app)/service-orders/actions'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import type { Role } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { ActiveOrdersPdfButton } from './ServiceOrderActiveExport'
import { ServiceOrderFilters } from './ServiceOrderFilters'
import { ServiceOrderListTable } from './ServiceOrderListTable'
import { FinishCleaningModal, StartCleaningModal } from './ServiceOrderTimeControls'
import { LiveTimer } from './LiveTimer'
import { formatDateTime } from './display'

export function ServiceOrderList({
  active,
  done,
  role,
  userId,
  donePage,
  doneTotalPages,
  initialQ,
  initialDate,
}: {
  active: ServiceOrderListItem[]
  done: ServiceOrderListItem[]
  role: Role
  userId?: string
  donePage: number
  doneTotalPages: number
  initialQ: string
  initialDate: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const [date, setDate] = useState(initialDate)
  const [startModalOrder, setStartModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishModalOrder, setFinishModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)

  useEffect(() => { setSearch(initialQ) }, [initialQ])
  useEffect(() => { setDate(initialDate) }, [initialDate])

  const pushFilters = useCallback(
    (q: string, d: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (d) params.set('date', d)
      params.set('donePage', '1')
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== initialQ || date !== initialDate) pushFilters(search, date)
    }, 300)
    return () => clearTimeout(t)
  }, [search, date, initialQ, initialDate, pushFilters])

  const filterOrder = (o: ServiceOrderListItem) => {
    const matchName = !search || (o.property?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchDate = !date || o.cleaning_date === date
    return matchName && matchDate
  }

  const allActive = active.filter(filterOrder)
  const inProgress = allActive.filter(o => o.status === 'in_progress')
  const open = allActive.filter(o => o.status === 'open')
  const hasFilter = search !== '' || date !== ''
  const doneSearchParams: Record<string, string> = {}
  if (search) doneSearchParams.q = search
  if (date) doneSearchParams.date = date

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

  function closeFinishModal() {
    setFinishModalOrder(null)
    setFinishNotes('')
  }

  return (
    <div className="space-y-5">
      <ServiceOrderFilters
        search={search}
        date={date}
        hasFilter={hasFilter}
        onSearchChange={setSearch}
        onDateChange={setDate}
        onClear={() => { setSearch(''); setDate('') }}
      />

      {inProgress.length > 0 && (
        <Card>
          <ListHeader title="In corso" count={inProgress.length} countClassName="bg-info/10 text-info" />
          <ServiceOrderListTable
            orders={inProgress}
            role={role}
            emptyText=""
            userId={userId}
            onFinish={setFinishModalOrder}
          />
        </Card>
      )}

      <Card>
        <ListHeader
          title="Aperti"
          count={open.length}
          countClassName="bg-warning-bg text-warning"
          action={<ActiveOrdersPdfButton orders={[...inProgress, ...open]} date={date} />}
        />
        <ServiceOrderListTable
          orders={open}
          role={role}
          emptyText="Nessun O.L. aperto."
          userId={userId}
          onStart={setStartModalOrder}
        />
      </Card>

      <Card>
        <ListHeader title="Completati" count={done.length} countClassName="bg-success-bg text-success" />
        <ServiceOrderListTable
          orders={done}
          role={role}
          emptyText="Nessun O.L. completato."
          userId={userId}
        />
        <Pagination
          currentPage={donePage}
          totalPages={doneTotalPages}
          basePath="/service-orders"
          searchParams={doneSearchParams}
        />
      </Card>

      {startModalOrder && (
        <StartCleaningModal
          propertyName={startModalOrder.property?.name}
          isLoading={isTrackingAction}
          onCancel={() => setStartModalOrder(null)}
          onConfirm={handleStartCleaning}
          details={<StartOrderDetails order={startModalOrder} />}
        />
      )}

      {finishModalOrder && (
        <FinishCleaningModal
          propertyName={finishModalOrder.property?.name}
          notes={finishNotes}
          isLoading={isTrackingAction}
          onNotesChange={setFinishNotes}
          onCancel={closeFinishModal}
          onConfirm={handleFinishCleaning}
          details={<FinishOrderDetails order={finishModalOrder} />}
          placeholder="Tutto OK, problemi riscontrati, note generali…"
          showOptionalLabel={false}
        />
      )}
    </div>
  )
}

function ListHeader({
  title,
  count,
  countClassName,
  action,
}: {
  title: string
  count: number
  countClassName: string
  action?: ReactNode
}) {
  return (
    <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {count > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${countClassName}`}>
          {count}
        </span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

function StartOrderDetails({ order }: { order: ServiceOrderListItem }) {
  return (
    <>
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">O.L.</p>
        <span className="text-xs font-mono text-muted-foreground">#{order.order_number}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Check-out</p>
          <p className="text-xs font-medium text-foreground">{formatDateTime(order.checkout_at)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Check-in</p>
          <p className="text-xs font-medium text-foreground">
            {order.checkin_at ? formatDateTime(order.checkin_at) : 'Nessun check-in programmato'}
          </p>
        </div>
      </div>
      {order.property?.avg_cleaning_hours != null && (
        <div className="pt-1 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Tempo Stimato</p>
          <p className="text-xs font-medium text-foreground">{order.property.avg_cleaning_hours}h</p>
        </div>
      )}
    </>
  )
}

function FinishOrderDetails({ order }: { order: ServiceOrderListItem }) {
  return (
    <>
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">O.L.</p>
        <span className="text-xs font-mono text-muted-foreground">#{order.order_number}</span>
      </div>
      {order.started_at && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
          <Timer size={13} className="text-info" />
          <span className="text-xs text-muted-foreground">Tempo in corso:</span>
          <LiveTimer startedAt={order.started_at} />
        </div>
      )}
    </>
  )
}
