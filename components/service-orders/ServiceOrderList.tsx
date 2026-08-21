'use client'

import { useCallback, useEffect, useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Timer, CalendarCheck } from 'lucide-react'
import { finishCleaning, startCleaning } from '@/app/(app)/service-orders/actions'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import type { Role } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import type { OperationalServiceOrderVisibility } from '@/lib/service-order-visibility'
import { getRomeDateOnly } from '@/lib/utils/date-rome'
import { OrdersPdfButton, CheckinReportPdfButton } from './ServiceOrderActiveExport'
import { ServiceOrderFilters } from './ServiceOrderFilters'
import { ServiceOrderListTable } from './ServiceOrderListTable'
import { FinishCleaningModal, StartCleaningModal } from './ServiceOrderTimeControls'
import { LiveTimer } from './LiveTimer'
import { formatDate, formatDateTime } from './display'
import { compareServiceOrderPriority } from './ordering'

import type { StaffOption } from '@/lib/types/view-models'
import { CleaningPhotoUploader } from './CleaningPhotoUploader'
import { useCleaningPhotoWorkflow } from './useCleaningPhotoWorkflow'

export function ServiceOrderList({
  active,
  done,
  doneForExport,
  role,
  userId,
  donePage,
  doneTotalPages,
  doneTotalCount,
  initialQ,
  initialCleaningStaffId,
  initialConsegnaStaffId,
  initialStartDate,
  initialEndDate,
  initialCheckinDate = '',
  staff,
  operationalVisibility,
  cleaningPhotosEnabled = false,
}: {
  active: ServiceOrderListItem[]
  done: ServiceOrderListItem[]
  doneForExport: ServiceOrderListItem[]
  role: Role
  userId?: string
  donePage: number
  doneTotalPages: number
  doneTotalCount: number
  initialQ: string
  initialCleaningStaffId: string
  initialConsegnaStaffId: string
  initialStartDate: string
  initialEndDate: string
  initialCheckinDate?: string
  staff: StaffOption[]
  operationalVisibility: OperationalServiceOrderVisibility | null
  cleaningPhotosEnabled?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQ)
  const [cleaningStaffId, setCleaningStaffId] = useState(initialCleaningStaffId)
  const [consegnaStaffId, setConsegnaStaffId] = useState(initialConsegnaStaffId)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [checkinDate, setCheckinDate] = useState(initialCheckinDate)
  const [startModalOrder, setStartModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishModalOrder, setFinishModalOrder] = useState<ServiceOrderListItem | null>(null)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)
  const beforePhotos = useCleaningPhotoWorkflow(startModalOrder?.id ?? '', 'before', cleaningPhotosEnabled)
  const afterPhotos = useCleaningPhotoWorkflow(finishModalOrder?.id ?? '', 'after', cleaningPhotosEnabled)

  const [prevInitial, setPrevInitial] = useState({
    q: initialQ,
    cleaningStaffId: initialCleaningStaffId,
    consegnaStaffId: initialConsegnaStaffId,
    startDate: initialStartDate,
    endDate: initialEndDate,
    checkinDate: initialCheckinDate,
  })

  if (
    prevInitial.q !== initialQ ||
    prevInitial.cleaningStaffId !== initialCleaningStaffId ||
    prevInitial.consegnaStaffId !== initialConsegnaStaffId ||
    prevInitial.startDate !== initialStartDate ||
    prevInitial.endDate !== initialEndDate ||
    prevInitial.checkinDate !== initialCheckinDate
  ) {
    setPrevInitial({
      q: initialQ,
      cleaningStaffId: initialCleaningStaffId,
      consegnaStaffId: initialConsegnaStaffId,
      startDate: initialStartDate,
      endDate: initialEndDate,
      checkinDate: initialCheckinDate,
    })
    setSearch(initialQ)
    setCleaningStaffId(initialCleaningStaffId)
    setConsegnaStaffId(initialConsegnaStaffId)
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
    setCheckinDate(initialCheckinDate)
  }

  const pushFilters = useCallback(
    (q: string, cleaningId: string, consegnaId: string, startD: string, endD: string, checkinD: string) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cleaningId) params.set('cleaningStaffId', cleaningId)
      if (consegnaId) params.set('consegnaStaffId', consegnaId)
      if (startD) params.set('startDate', startD)
      if (endD) params.set('endDate', endD)
      if (checkinD) params.set('checkinDate', checkinD)
      params.set('donePage', '1')
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname],
  )

  useEffect(() => {
    const isDirty =
      search !== initialQ ||
      cleaningStaffId !== initialCleaningStaffId ||
      consegnaStaffId !== initialConsegnaStaffId ||
      startDate !== initialStartDate ||
      endDate !== initialEndDate ||
      checkinDate !== initialCheckinDate

    if (!isDirty) return

    const t = setTimeout(() => {
      pushFilters(search, cleaningStaffId, consegnaStaffId, startDate, endDate, checkinDate)
    }, 300)
    return () => clearTimeout(t)
  }, [search, cleaningStaffId, consegnaStaffId, startDate, endDate, checkinDate, initialQ, initialCleaningStaffId, initialConsegnaStaffId, initialStartDate, initialEndDate, initialCheckinDate, pushFilters])

  useEffect(() => {
    if (!operationalVisibility) return

    const refreshOnRomeDateChange = () => {
      if (getRomeDateOnly() !== operationalVisibility.today) {
        startTransition(() => router.refresh())
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshOnRomeDateChange()
    }

    window.addEventListener('focus', refreshOnRomeDateChange)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshOnRomeDateChange)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [operationalVisibility, router])

  const filterOrder = (o: ServiceOrderListItem) => {
    const matchName = !search || (o.property?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCleaning = !cleaningStaffId || o.cleaning_staff_ids?.includes(cleaningStaffId)
    const matchConsegna = !consegnaStaffId || o.consegna_staff_id === consegnaStaffId
    return matchName && matchCleaning && matchConsegna
  }

  const allActive = active.filter(filterOrder)
  const inProgress = allActive
    .filter(o => o.status === 'in_progress')
    .sort(compareServiceOrderPriority)
  const open = allActive.filter(o => o.status === 'open')
  const sortedOpen = [...open].sort(compareServiceOrderPriority)
  
  const hasFilter = search !== '' || cleaningStaffId !== '' || consegnaStaffId !== '' || startDate !== '' || endDate !== '' || checkinDate !== ''
  
  const isFiltersDirty =
    search !== initialQ ||
    cleaningStaffId !== initialCleaningStaffId ||
    consegnaStaffId !== initialConsegnaStaffId ||
    startDate !== initialStartDate ||
    endDate !== initialEndDate ||
    checkinDate !== initialCheckinDate

  const isSyncing = isFiltersDirty || isPending
  const selectedRangeLabel = startDate && endDate && startDate !== endDate
    ? `Dal ${formatDate(startDate)} al ${formatDate(endDate)}`
    : undefined
  const activePdfDateLabel = selectedRangeLabel ?? (
    operationalVisibility && !startDate && !endDate
      ? `Fino al ${formatDate(operationalVisibility.maxVisibleDate)} (Oggi)`
      : undefined
  )
  
  const doneSearchParams: Record<string, string> = {}
  if (search) doneSearchParams.q = search
  if (cleaningStaffId) doneSearchParams.cleaningStaffId = cleaningStaffId
  if (consegnaStaffId) doneSearchParams.consegnaStaffId = consegnaStaffId
  if (startDate) doneSearchParams.startDate = startDate
  if (endDate) doneSearchParams.endDate = endDate
  if (checkinDate) doneSearchParams.checkinDate = checkinDate

  const isCliente = role === 'cliente'

  async function handleStartCleaning() {
    if (!startModalOrder) return
    setIsTrackingAction(true)
    try {
      const photoIds = await beforePhotos.uploadAll()
      const result = await startCleaning(startModalOrder.id, photoIds)
      if (result?.error) {
        alert(result.error)
      } else {
        beforePhotos.reset()
        setStartModalOrder(null)
        startTransition(() => router.refresh())
      }
    } catch (error: unknown) {
      console.error('Error starting cleaning:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (
        errorMsg.includes('UnrecognizedActionError') ||
        errorMsg.includes('Server Action') ||
        errorMsg.includes('was not found')
      ) {
        window.location.reload()
      } else {
        alert('Si è verificato un errore: ' + errorMsg)
      }
    } finally {
      setIsTrackingAction(false)
    }
  }

  async function handleFinishCleaning() {
    if (!finishModalOrder) return
    setIsTrackingAction(true)
    try {
      const photoIds = await afterPhotos.uploadAll()
      const result = await finishCleaning(finishModalOrder.id, finishNotes, photoIds)
      if (result?.error) {
        alert(result.error)
      } else {
        afterPhotos.reset()
        setFinishModalOrder(null)
        setFinishNotes('')
        startTransition(() => router.refresh())
      }
    } catch (error: unknown) {
      console.error('Error finishing cleaning:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (
        errorMsg.includes('UnrecognizedActionError') ||
        errorMsg.includes('Server Action') ||
        errorMsg.includes('was not found')
      ) {
        window.location.reload()
      } else {
        alert('Si è verificato un errore: ' + errorMsg)
      }
    } finally {
      setIsTrackingAction(false)
    }
  }

  async function closeFinishModal() {
    await afterPhotos.discardAll()
    setFinishModalOrder(null)
    setFinishNotes('')
  }

  return (
    <div className="notranslate space-y-5" translate="no">
      {operationalVisibility && (
        <div role="status" className="rounded-lg border border-info/25 bg-info/5 px-4 py-3 text-sm text-foreground">
          <span>
            Sono visibili solo gli O.L. assegnati con data di pulizia fino a oggi
            (ora di Roma). Gli O.L. dei giorni successivi saranno mostrati automaticamente nel giorno previsto.
          </span>
        </div>
      )}

      <ServiceOrderFilters
        search={search}
        cleaningStaffId={cleaningStaffId}
        consegnaStaffId={consegnaStaffId}
        startDate={startDate}
        endDate={endDate}
        checkinDate={checkinDate}
        staff={staff}
        maxDate={operationalVisibility?.maxVisibleDate}
        hasFilter={hasFilter}
        onSearchChange={setSearch}
        onCleaningStaffChange={setCleaningStaffId}
        onConsegnaStaffChange={setConsegnaStaffId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onCheckinDateChange={setCheckinDate}
        onClear={() => {
          setSearch('')
          setCleaningStaffId('')
          setConsegnaStaffId('')
          setStartDate('')
          setEndDate('')
          setCheckinDate('')
        }}
      />

      {checkinDate && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-xl px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <CalendarCheck size={18} />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground block">
                Check-in previsti per il {formatDate(checkinDate)}
              </span>
              <span className="text-xs text-muted-foreground">
                Totale di {allActive.length + doneTotalCount} {allActive.length + doneTotalCount === 1 ? 'immobile' : 'immobili'} identificati
              </span>
            </div>
          </div>
          <CheckinReportPdfButton
            orders={[...allActive, ...doneForExport]}
            checkinDate={checkinDate}
            isCliente={isCliente}
            disabled={isSyncing}
          />
        </div>
      )}

      {inProgress.length > 0 && (
        <Card>
          <ListHeader
            title="In corso"
            count={inProgress.length}
            countClassName="bg-info/10 text-info"
            action={<OrdersPdfButton orders={inProgress} date={startDate || endDate || ''} dateLabel={activePdfDateLabel} status="in_progress" isCliente={isCliente} disabled={isSyncing} />}
          />
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
          action={<OrdersPdfButton orders={sortedOpen} date={startDate || endDate || ''} dateLabel={activePdfDateLabel} status="open" isCliente={isCliente} disabled={isSyncing} />}
        />
        <ServiceOrderListTable
          orders={sortedOpen}
          role={role}
          emptyText={operationalVisibility ? 'Nessun O.L. assegnato fino a oggi.' : 'Nessun O.L. aperto.'}
          userId={userId}
          onStart={setStartModalOrder}
        />
      </Card>

      <Card>
        <ListHeader
          title="Completati"
          count={doneTotalCount}
          countClassName="bg-success-bg text-success"
          action={<OrdersPdfButton orders={doneForExport} date={startDate || endDate || ''} dateLabel={selectedRangeLabel} status="done" isCliente={isCliente} disabled={isSyncing} />}
        />
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
          key={`start-modal-${startModalOrder.id}`}
          propertyName={startModalOrder.property?.name}
          isLoading={isTrackingAction || beforePhotos.isUploading}
          onCancel={async () => { await beforePhotos.discardAll(); setStartModalOrder(null) }}
          onConfirm={handleStartCleaning}
          details={<StartOrderDetails order={startModalOrder} />}
          cleaningNotes={startModalOrder.cleaning_notes}
          photoUploader={cleaningPhotosEnabled ? (
            <CleaningPhotoUploader
              phase="before"
              items={beforePhotos.items}
              error={beforePhotos.selectionError}
              disabled={isTrackingAction || beforePhotos.isUploading}
              onFiles={beforePhotos.addFiles}
              onRemove={beforePhotos.removeItem}
            />
          ) : undefined}
        />
      )}

      {finishModalOrder && (
        <FinishCleaningModal
          key={`finish-modal-${finishModalOrder.id}`}
          propertyName={finishModalOrder.property?.name}
          notes={finishNotes}
          isLoading={isTrackingAction || afterPhotos.isUploading}
          onNotesChange={setFinishNotes}
          onCancel={closeFinishModal}
          onConfirm={handleFinishCleaning}
          details={<FinishOrderDetails order={finishModalOrder} />}
          placeholder="Tutto OK, problemi riscontrati, note generali…"
          showOptionalLabel={false}
          photoUploader={cleaningPhotosEnabled ? (
            <CleaningPhotoUploader
              phase="after"
              items={afterPhotos.items}
              error={afterPhotos.selectionError}
              disabled={isTrackingAction || afterPhotos.isUploading}
              onFiles={afterPhotos.addFiles}
              onRemove={afterPhotos.removeItem}
            />
          ) : undefined}
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
