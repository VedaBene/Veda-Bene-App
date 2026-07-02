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

import type { ServiceOrderPropertyOption } from '@/lib/types/view-models'

export function ServiceOrderList({
  active,
  done,
  role,
  userId,
  donePage,
  doneTotalPages,
  initialQ,
  initialPropertyId,
  initialStartDate,
  initialEndDate,
  properties,
}: {
  active: ServiceOrderListItem[]
  done: ServiceOrderListItem[]
  role: Role
  userId?: string
  donePage: number
  doneTotalPages: number
  initialQ: string
  initialPropertyId: string
  initialStartDate: string
  initialEndDate: string
  properties: ServiceOrderPropertyOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const [propertyId, setPropertyId] = useState(initialPropertyId)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [startModalOrder, setStartModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishModalOrder, setFinishModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)

  useEffect(() => { setSearch(initialQ) }, [initialQ])
  useEffect(() => { setPropertyId(initialPropertyId) }, [initialPropertyId])
  useEffect(() => { setStartDate(initialStartDate) }, [initialStartDate])
  useEffect(() => { setEndDate(initialEndDate) }, [initialEndDate])

  const pushFilters = useCallback(
    (q: string, propId: string, startD: string, endD: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (propId) params.set('propertyId', propId)
      if (startD) params.set('startDate', startD)
      if (endD) params.set('endDate', endD)
      params.set('donePage', '1')
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (
        search !== initialQ ||
        propertyId !== initialPropertyId ||
        startDate !== initialStartDate ||
        endDate !== initialEndDate
      ) {
        pushFilters(search, propertyId, startDate, endDate)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search, propertyId, startDate, endDate, initialQ, initialPropertyId, initialStartDate, initialEndDate, pushFilters])

  const filterOrder = (o: ServiceOrderListItem) => {
    const matchName = !search || (o.property?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchProperty = !propertyId || o.property?.id === propertyId
    return matchName && matchProperty
  }

  const allActive = active.filter(filterOrder)
  const inProgress = allActive.filter(o => o.status === 'in_progress')
  const open = allActive.filter(o => o.status === 'open')
  const sortedOpen = [...open].sort(compareIntervals)
  
  const hasFilter = search !== '' || propertyId !== '' || startDate !== '' || endDate !== ''
  
  const doneSearchParams: Record<string, string> = {}
  if (search) doneSearchParams.q = search
  if (propertyId) doneSearchParams.propertyId = propertyId
  if (startDate) doneSearchParams.startDate = startDate
  if (endDate) doneSearchParams.endDate = endDate

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
        propertyId={propertyId}
        startDate={startDate}
        endDate={endDate}
        properties={properties}
        hasFilter={hasFilter}
        onSearchChange={setSearch}
        onPropertyChange={setPropertyId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={() => {
          setSearch('')
          setPropertyId('')
          setStartDate('')
          setEndDate('')
        }}
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
          action={<ActiveOrdersPdfButton orders={[...inProgress, ...sortedOpen]} date={startDate || endDate || ''} />}
        />
        <ServiceOrderListTable
          orders={sortedOpen}
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
        {hasFilter && (
          <Pagination
            currentPage={donePage}
            totalPages={doneTotalPages}
            basePath="/service-orders"
            searchParams={doneSearchParams}
          />
        )}
      </Card>

      {startModalOrder && (
        <StartCleaningModal
          propertyName={startModalOrder.property?.name}
          isLoading={isTrackingAction}
          onCancel={() => setStartModalOrder(null)}
          onConfirm={handleStartCleaning}
          details={<StartOrderDetails order={startModalOrder} />}
          cleaningNotes={startModalOrder.cleaning_notes}
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

export function compareIntervals(
  a: { checkin_at?: string | null; checkout_at?: string | null; order_number?: number | null },
  b: { checkin_at?: string | null; checkout_at?: string | null; order_number?: number | null }
) {
  const hasA = a.checkin_at && a.checkout_at
  const hasB = b.checkin_at && b.checkout_at

  if (hasA && hasB) {
    const diffA = new Date(a.checkin_at!).getTime() - new Date(a.checkout_at!).getTime()
    const diffB = new Date(b.checkin_at!).getTime() - new Date(b.checkout_at!).getTime()
    
    if (diffA !== diffB) {
      return diffA - diffB
    }
    return (a.order_number ?? 0) - (b.order_number ?? 0)
  }

  if (hasA) return -1
  if (hasB) return 1

  return (a.order_number ?? 0) - (b.order_number ?? 0)
}
