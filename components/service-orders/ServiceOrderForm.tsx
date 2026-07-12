'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
import {
  createServiceOrder,
  finishCleaning,
  getLastCleaningForProperty,
  startCleaning,
  updateExtraServices,
  updateServiceOrder,
  reopenServiceOrder,
} from '@/app/(app)/service-orders/actions'
import { Button } from '@/components/ui/Button'
import type { PricingMode, Role } from '@/lib/types/database'
import { canOperateCleaningTracking } from '@/lib/service-order-tracking'
import type {
  ServiceOrderFormData,
  ServiceOrderPropertyOption,
  StaffOption,
} from '@/lib/types/view-models'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { ServiceOrderExtrasSection } from './ServiceOrderPricingControls'
import {
  CleaningNotesSection,
  OccupancySection,
  PropertyStaffSection,
  VisitDetailsSection,
} from './ServiceOrderFormSections'
import { ServiceOrderStatusControls } from './ServiceOrderStatusControls'
import {
  FinishCleaningModal,
  StartCleaningModal,
  TimeSummaryPanel,
  TimeTrackingPanel,
} from './ServiceOrderTimeControls'
import { hoursUntil } from './display'

export function ServiceOrderForm({
  order,
  properties,
  staff,
  role,
  userId,
  deleteAction,
  readOnly = false,
}: {
  order?: ServiceOrderFormData
  properties: ServiceOrderPropertyOption[]
  staff: StaffOption[]
  role: Role
  userId?: string
  deleteAction?: () => Promise<{ success: false; error: string } | void>
  readOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [showStartModal, setShowStartModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)
  const [isSavingExtras, setIsSavingExtras] = useState(false)

  const [open, setOpen] = useState({ imovel: true, visita: true, ocupacao: false, obsLimpeza: false, extras: false })
  const toggle = (s: keyof typeof open) => setOpen(prev => ({ ...prev, [s]: !prev[s] }))

  const isCliente = role === 'cliente'
  const isAdminOrSec = ['admin', 'secretaria'].includes(role)
  const canEdit = isAdminOrSec && !readOnly
  const canEditExtras = isAdminOrSec && order?.status === 'done'
  const canOperateTracking = !!order && canOperateCleaningTracking(role, userId, order)

  const [propertyId, setPropertyId] = useState(order?.property_id ?? '')
  const [cleaningStaffIds, setCleaningStaffIds] = useState<string[]>(order?.cleaning_staff_ids ?? [])
  const [consegnaStaffId, setConsegnaStaffId] = useState(order?.consegna_staff_id ?? '')
  const selectedProperty = properties.find(p => p.id === propertyId)

  const [lastCleaning, setLastCleaning] = useState<{
    orderNumber: number
    date: string
    staffName: string
  } | null>(null)

  const [prevPropertyId, setPrevPropertyId] = useState(propertyId)
  if (propertyId !== prevPropertyId) {
    setPrevPropertyId(propertyId)
    setLastCleaning(null)
  }

  useEffect(() => {
    // Evita chamar a Server Action se o usuário não for admin ou secretaria, poupando requisições e prevenindo erros de autorização no Sentry.
    if (!propertyId || !isAdminOrSec) return

    let active = true
    getLastCleaningForProperty(propertyId)
      .then(data => {
        if (active) setLastCleaning(data)
      })
      .catch(() => {
        if (active) setLastCleaning(null)
      })

    return () => {
      active = false
    }
  }, [propertyId, isAdminOrSec])

  const [cleaningDate, setCleaningDate] = useState(order?.cleaning_date ?? '')
  const [checkoutAt, setCheckoutAt] = useState(order?.checkout_at ? order.checkout_at.slice(0, 16) : '')
  const [checkinAt, setCheckinAt] = useState(order?.checkin_at ? order.checkin_at.slice(0, 16) : '')
  const urgencyWarning = checkoutAt && checkinAt
    ? (() => {
        const hours = hoursUntil(checkoutAt, checkinAt)
        return hours !== null && hours > 0 && hours < 3
      })()
    : false

  const [realGuests, setRealGuests] = useState(order?.real_guests?.toString() ?? '')
  const [doubleBeds, setDoubleBeds] = useState(order?.double_beds?.toString() ?? '0')
  const [singleBeds, setSingleBeds] = useState(order?.single_beds?.toString() ?? '0')
  const [sofaBeds, setSofaBeds] = useState(order?.sofa_beds?.toString() ?? '0')
  const [armchairBeds, setArmchairBeds] = useState(order?.armchair_beds?.toString() ?? '0')
  const [bathrooms, setBathrooms] = useState(order?.bathrooms?.toString() ?? '0')
  const [bidets, setBidets] = useState(order?.bidets?.toString() ?? '0')
  const [cribs, setCribs] = useState(order?.cribs?.toString() ?? '0')
  const [cleaningNotes, setCleaningNotes] = useState(order?.cleaning_notes ?? '')
  const [extraDesc, setExtraDesc] = useState(order?.extra_services_description ?? '')
  const [extraPrice, setExtraPrice] = useState(order?.extra_services_price?.toString() ?? '0')
  const [pricingMode, setPricingMode] = useState<PricingMode>(order?.pricing_mode ?? 'standard')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('property_id', propertyId)
    if (!isCliente) {
      cleaningStaffIds.forEach(id => fd.append('cleaning_staff_ids', id))
      fd.set('consegna_staff_id', consegnaStaffId)
    }
    fd.set('cleaning_date', cleaningDate)
    fd.set('checkout_at', checkoutAt)
    fd.set('checkin_at', checkinAt)
    fd.set('real_guests', realGuests)
    fd.set('double_beds', doubleBeds)
    fd.set('single_beds', singleBeds)
    fd.set('sofa_beds', sofaBeds)
    fd.set('armchair_beds', armchairBeds)
    fd.set('bathrooms', bathrooms)
    fd.set('bidets', bidets)
    fd.set('cribs', cribs)
    fd.set('cleaning_notes', cleaningNotes)
    fd.set('extra_services_description', extraDesc)
    fd.set('extra_services_price', extraPrice)
    fd.set('pricing_mode', pricingMode)

    startTransition(async () => {
      const result = order ? await updateServiceOrder(order.id, fd) : await createServiceOrder(fd)
      if (result && !result.success) setError(result.error)
      else if (result?.success) setSuccess(true)
    })
  }

  async function handleReopen() {
    if (!order) return
    setIsUpdatingStatus(true)
    setError(null)
    const result = await reopenServiceOrder(order.id)
    if (result && !result.success) setError(result.error)
    setIsUpdatingStatus(false)
  }

  async function handleDelete() {
    if (!deleteAction) return
    if (!window.confirm('Sei sicuro di voler eliminare questo O.L.? Questa azione non può essere annullata.')) return
    setIsDeleting(true)
    const result = await deleteAction()
    if (result && !result.success) {
      setError(result.error)
      setIsDeleting(false)
    }
  }

  async function handleStartCleaning() {
    if (!order) return
    setIsTrackingAction(true)
    setError(null)
    const result = await startCleaning(order.id)
    if (result && !result.success) setError(result.error)
    setIsTrackingAction(false)
    setShowStartModal(false)
  }

  async function handleFinishCleaning() {
    if (!order) return
    setIsTrackingAction(true)
    setError(null)
    const result = await finishCleaning(order.id, finishNotes)
    if (result && !result.success) setError(result.error)
    setIsTrackingAction(false)
    setShowFinishModal(false)
    setFinishNotes('')
  }

  async function handleSaveExtras() {
    if (!order) return
    setIsSavingExtras(true)
    setError(null)
    setSuccess(false)
    const result = await updateExtraServices(order.id, extraDesc, parseFloat(extraPrice) || 0, pricingMode)
    if (result && !result.success) setError(result.error)
    else setSuccess(true)
    setIsSavingExtras(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      {order && (
        <ServiceOrderStatusControls
          status={order.status}
          isUrgent={order.is_urgent}
          canEdit={canEdit}
          isUpdating={isUpdatingStatus}
          onReopen={handleReopen}
        />
      )}

      {order && canOperateTracking && (
        <TimeTrackingPanel
          status={order.status}
          startedAt={order.started_at}
          workedMinutes={order.worked_minutes}
          completionNotes={order.completion_notes}
          onOpenStart={() => setShowStartModal(true)}
          onOpenFinish={() => setShowFinishModal(true)}
        />
      )}

      {order && canEdit && order.status === 'done' && (order.worked_minutes != null || order.completion_notes) && (
        <TimeSummaryPanel workedMinutes={order.worked_minutes} completionNotes={order.completion_notes} />
      )}

      {showStartModal && order && (
        <StartCleaningModal
          propertyName={selectedProperty?.name}
          isLoading={isTrackingAction}
          onCancel={() => setShowStartModal(false)}
          onConfirm={handleStartCleaning}
          cleaningNotes={cleaningNotes}
        />
      )}

      {showFinishModal && order && (
        <FinishCleaningModal
          propertyName={selectedProperty?.name}
          notes={finishNotes}
          isLoading={isTrackingAction}
          onNotesChange={setFinishNotes}
          onCancel={() => { setShowFinishModal(false); setFinishNotes('') }}
          onConfirm={handleFinishCleaning}
        />
      )}

      <PropertyStaffSection
        isOpen={open.imovel}
        onToggle={() => toggle('imovel')}
        propertyId={propertyId}
        onPropertyIdChange={setPropertyId}
        cleaningStaffIds={cleaningStaffIds}
        onCleaningStaffIdsChange={setCleaningStaffIds}
        consegnaStaffId={consegnaStaffId}
        onConsegnaStaffIdChange={setConsegnaStaffId}
        properties={properties}
        staff={staff}
        selectedProperty={selectedProperty}
        canEdit={canEdit}
        isCliente={isCliente}
        lastCleaning={lastCleaning}
      />

      <VisitDetailsSection
        isOpen={open.visita}
        onToggle={() => toggle('visita')}
        cleaningDate={cleaningDate}
        onCleaningDateChange={setCleaningDate}
        checkoutAt={checkoutAt}
        onCheckoutAtChange={setCheckoutAt}
        checkinAt={checkinAt}
        onCheckinAtChange={setCheckinAt}
        canEdit={canEdit}
        urgencyWarning={urgencyWarning}
      />

      <OccupancySection
        isOpen={open.ocupacao}
        onToggle={() => toggle('ocupacao')}
        canEdit={canEdit}
        selectedProperty={selectedProperty}
        values={{ realGuests, doubleBeds, singleBeds, sofaBeds, armchairBeds, bathrooms, bidets, cribs }}
        setters={{ realGuests: setRealGuests, doubleBeds: setDoubleBeds, singleBeds: setSingleBeds, sofaBeds: setSofaBeds, armchairBeds: setArmchairBeds, bathrooms: setBathrooms, bidets: setBidets, cribs: setCribs }}
      />

      {(canEdit || (order && order.cleaning_notes)) && (
        <CleaningNotesSection
          isOpen={open.obsLimpeza}
          onToggle={() => toggle('obsLimpeza')}
          value={cleaningNotes}
          onChange={setCleaningNotes}
          canEdit={canEdit}
        />
      )}

      {isAdminOrSec && (
        <ServiceOrderExtrasSection
          isOpen={open.extras}
          onToggle={() => toggle('extras')}
          pricingMode={pricingMode}
          onPricingModeChange={setPricingMode}
          extraDescription={extraDesc}
          onExtraDescriptionChange={setExtraDesc}
          extraPrice={extraPrice}
          onExtraPriceChange={setExtraPrice}
          disabled={!canEdit && !canEditExtras}
          basePrice={role === 'admin' ? selectedProperty?.base_price ?? null : null}
          canViewPricing={role === 'admin'}
          canSaveExtras={canEditExtras}
          isSavingExtras={isSavingExtras}
          onSaveExtras={handleSaveExtras}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger-bg px-4 py-3 rounded-xl">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-success bg-success-bg px-4 py-3 rounded-xl">
          <CheckCircle size={16} className="shrink-0" />
          O.L. salvato con successo.
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <Button type="submit" isLoading={isPending} variant="accent">
            {isPending ? 'Salvataggio…' : order ? 'Salva Modifiche' : 'Crea O.L.'}
          </Button>

          {deleteAction && (
            <Button type="button" onClick={handleDelete} isLoading={isDeleting} variant="danger" size="sm">
              {isDeleting ? 'Eliminazione…' : 'Elimina O.L.'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
