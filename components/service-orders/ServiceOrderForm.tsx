'use client'

import { useState, useTransition } from 'react'
import { createServiceOrder, updateServiceOrder, updateServiceOrderStatus, startCleaning, finishCleaning, updateExtraServices } from '@/app/(app)/service-orders/actions'
import { LiveTimer, formatWorkedTime } from './LiveTimer'
import { UrgencyBadge } from './UrgencyBadge'
import { Section } from '@/components/ui/Section'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Building2, CalendarDays, Users, CheckCircle, AlertCircle, Zap, Play, Flag, Timer, X, ClipboardList, PlusCircle } from 'lucide-react'
import type { OSStatus, PricingMode, Role } from '@/lib/types/database'
import type {
  ServiceOrderFormData,
  ServiceOrderPropertyOption,
  StaffOption,
} from '@/lib/types/view-models'

const inputCls =
  'w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50'

const STATUS_LABEL: Record<OSStatus, string> = {
  open: 'Aperto',
  in_progress: 'In corso',
  done: 'Completato',
}

const STATUS_VARIANT: Record<OSStatus, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
}

const PRICING_MODE_OPTIONS: {
  value: PricingMode
  label: string
  adminHint: string
  restrictedHint: string
}[] = [
  {
    value: 'standard',
    label: 'Standard',
    adminHint: 'Prezzo Base + Supplemento per Persona',
    restrictedHint: "Calcolo automatico dalla tabella interna dell'immobile",
  },
  {
    value: 'ripasso',
    label: 'Ripasso',
    adminHint: "60% del Prezzo Base dell'immobile",
    restrictedHint: 'Calcolo automatico con la regola Ripasso',
  },
  {
    value: 'out_long_stay',
    label: 'Out Long Stay',
    adminHint: 'Tempo Lavorato per tariffa interna',
    restrictedHint: 'Calcolo automatico per Tempo Lavorato',
  },
]

function PricingModeSelector({
  value,
  onChange,
  disabled,
  basePrice,
  canViewPricing,
}: {
  value: PricingMode
  onChange: (v: PricingMode) => void
  disabled: boolean
  basePrice: number | null
  canViewPricing: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PRICING_MODE_OPTIONS.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-lg border px-3 py-2.5 transition-all ${
                active
                  ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                  : 'border-input-border bg-white hover:border-accent/40'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="text-sm font-semibold text-foreground">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {canViewPricing ? opt.adminHint : opt.restrictedHint}
              </div>
            </button>
          )
        })}
      </div>
      {value === 'ripasso' && (
        <p className="text-xs text-muted-foreground">
          {canViewPricing && basePrice != null
            ? <>Valore calcolato: <strong className="text-foreground">€{(basePrice * 0.6).toFixed(2)}</strong> (60% di €{basePrice.toFixed(2)})</>
            : canViewPricing
              ? 'Definisci il Prezzo Base nella scheda immobile affinché il calcolo funzioni.'
              : 'Calcolato automaticamente in base alla regola interna.'}
        </p>
      )}
      {value === 'out_long_stay' && (
        <p className="text-xs text-muted-foreground">
          {canViewPricing
            ? 'Il valore sarà calcolato al completamento della pulizia tramite tariffa interna.'
            : 'Il valore sarà calcolato automaticamente al completamento della pulizia.'}
        </p>
      )}
    </div>
  )
}

function hoursUntil(checkout: string, checkin: string): number | null {
  const co = new Date(checkout)
  const ci = new Date(checkin)
  if (isNaN(co.getTime()) || isNaN(ci.getTime())) return null
  return (ci.getTime() - co.getTime()) / 3600000
}

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

  // Time tracking modals
  const [showStartModal, setShowStartModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishNotes, setFinishNotes] = useState('')
  const [isTrackingAction, setIsTrackingAction] = useState(false)

  const [open, setOpen] = useState({ imovel: true, visita: true, ocupacao: false, obsLimpeza: false, extras: false })
  function toggle(s: keyof typeof open) {
    setOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const isCliente = role === 'cliente'
  const canEdit = ['admin', 'secretaria'].includes(role) && !readOnly

  // Apenas o responsável de limpeza vê o painel de tempo (consegna é read-only).
  const isAssignedWorker = role === 'limpeza' && !!userId && order?.cleaning_staff_id === userId

  const [propertyId, setPropertyId] = useState(order?.property_id ?? properties[0]?.id ?? '')
  const [cleaningStaffId, setCleaningStaffId] = useState(order?.cleaning_staff_id ?? '')
  const [consegnaStaffId, setConsegnaStaffId] = useState(order?.consegna_staff_id ?? '')

  const selectedProperty = properties.find(p => p.id === propertyId)

  const [cleaningDate, setCleaningDate] = useState(order?.cleaning_date ?? '')
  const [checkoutAt, setCheckoutAt] = useState(
    order?.checkout_at ? order.checkout_at.slice(0, 16) : '',
  )
  const [checkinAt, setCheckinAt] = useState(
    order?.checkin_at ? order.checkin_at.slice(0, 16) : '',
  )

  const urgencyWarning = (() => {
    if (!checkoutAt || !checkinAt) return false
    const hours = hoursUntil(checkoutAt, checkinAt)
    return hours !== null && hours > 0 && hours < 3
  })()

  const [realGuests, setRealGuests] = useState(order?.real_guests?.toString() ?? '')
  const [doubleBeds, setDoubleBeds] = useState(order?.double_beds?.toString() ?? '0')
  const [singleBeds, setSingleBeds] = useState(order?.single_beds?.toString() ?? '0')
  const [sofaBeds, setSofaBeds] = useState(order?.sofa_beds?.toString() ?? '0')
  const [armchairBeds, setArmchairBeds] = useState(order?.armchair_beds?.toString() ?? '0')
  const [bathrooms, setBathrooms] = useState(order?.bathrooms?.toString() ?? '0')
  const [bidets, setBidets] = useState(order?.bidets?.toString() ?? '0')
  const [cribs, setCribs] = useState(order?.cribs?.toString() ?? '0')

  // Tópico 4 & 5
  const [cleaningNotes, setCleaningNotes] = useState(order?.cleaning_notes ?? '')
  const [extraDesc, setExtraDesc] = useState(order?.extra_services_description ?? '')
  const [extraPrice, setExtraPrice] = useState(order?.extra_services_price?.toString() ?? '0')
  const [pricingMode, setPricingMode] = useState<PricingMode>(order?.pricing_mode ?? 'standard')
  const [isSavingExtras, setIsSavingExtras] = useState(false)

  const isAdminOrSec = ['admin', 'secretaria'].includes(role)
  // Section 5 can be edited even on finalized orders (by admin/secretaria)
  const canEditExtras = isAdminOrSec && order?.status === 'done'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('property_id', propertyId)
    if (!isCliente) {
      fd.set('cleaning_staff_id', cleaningStaffId)
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
      const result = order
        ? await updateServiceOrder(order.id, fd)
        : await createServiceOrder(fd)

      if (result && !result.success) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(true)
      }
    })
  }

  async function handleStatusChange(newStatus: OSStatus) {
    if (!order) return
    setIsUpdatingStatus(true)
    setError(null)
    const result = await updateServiceOrderStatus(order.id, newStatus)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      {/* Status bar */}
      {order && (
        <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-card">
          <span className="text-sm text-muted-foreground font-medium">Stato:</span>
          <Badge variant={STATUS_VARIANT[order.status]} label={STATUS_LABEL[order.status]} dot />
          <UrgencyBadge isUrgent={order.is_urgent} />
          {canEdit && (
            <div className="ml-auto flex gap-2">
              {order.status !== 'in_progress' && (
                <Button type="button" size="sm" variant="secondary" disabled={isUpdatingStatus} onClick={() => handleStatusChange('in_progress')}>
                  In corso
                </Button>
              )}
              {order.status !== 'done' && (
                <Button type="button" size="sm" variant="accent" disabled={isUpdatingStatus} onClick={() => handleStatusChange('done')}>
                  Completa
                </Button>
              )}
              {order.status !== 'open' && (
                <Button type="button" size="sm" variant="ghost" disabled={isUpdatingStatus} onClick={() => handleStatusChange('open')}>
                  Riapri
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Time tracking panel — visible to assigned worker */}
      {order && isAssignedWorker && (
        <div className="p-4 bg-card rounded-xl border border-border shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-accent" />
            <span className="text-sm font-semibold text-foreground">Controllo Tempo</span>
          </div>

          {/* Open: show start button */}
          {order.status === 'open' && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">Clicca sotto per avviare la pulizia e registrare l&apos;orario di inizio.</p>
              <Button type="button" variant="accent" icon={<Play size={15} />} onClick={() => setShowStartModal(true)}>
                Avvia Pulizia
              </Button>
            </div>
          )}

          {/* In progress: show live timer + finish button */}
          {order.status === 'in_progress' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-info flex-1">
                <span className="text-xs text-muted-foreground">In corso da</span>
                {order.started_at
                  ? <LiveTimer startedAt={order.started_at} />
                  : <span className="text-sm font-medium">—</span>
                }
              </div>
              <Button type="button" variant="accent" icon={<Flag size={15} />} onClick={() => setShowFinishModal(true)}>
                Completa Pulizia
              </Button>
            </div>
          )}

          {/* Done: show summary */}
          {order.status === 'done' && order.worked_minutes != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={15} className="text-success shrink-0" />
              Tempo totale: <span className="font-semibold text-foreground">{formatWorkedTime(order.worked_minutes)}</span>
              {order.completion_notes && (
                <span className="ml-2 text-foreground/60 truncate max-w-xs" title={order.completion_notes}>
                  · {order.completion_notes}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completion notes display for admin/secretaria */}
      {order && canEdit && order.status === 'done' && (order.worked_minutes != null || order.completion_notes) && (
        <div className="p-4 bg-card rounded-xl border border-border shadow-card space-y-2">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-accent" />
            <span className="text-sm font-semibold text-foreground">Riepilogo Tempo</span>
          </div>
          {order.worked_minutes != null && (
            <p className="text-sm text-muted-foreground">
              Tempo Lavorato: <span className="font-semibold text-foreground">{formatWorkedTime(order.worked_minutes)}</span>
            </p>
          )}
          {order.completion_notes && (
            <p className="text-sm text-muted-foreground">
              Note: <span className="text-foreground">{order.completion_notes}</span>
            </p>
          )}
        </div>
      )}

      {/* Modal: Avvia Pulizia */}
      {showStartModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Avvia Pulizia</h2>
              </div>
              <button type="button" onClick={() => setShowStartModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Immobile</p>
              <p className="text-sm font-semibold text-foreground">{selectedProperty?.name ?? '—'}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Alla conferma, l&apos;orario di inizio verrà registrato e lo stato passerà a <strong>In corso</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowStartModal(false)} className="flex-1">
                Annulla
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleStartCleaning} className="flex-1">
                Conferma
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Completa Pulizia */}
      {showFinishModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Completa Pulizia</h2>
              </div>
              <button type="button" onClick={() => { setShowFinishModal(false); setFinishNotes('') }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Immobile</p>
              <p className="text-sm font-semibold text-foreground">{selectedProperty?.name ?? '—'}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Note <span className="normal-case font-normal">(opzionale)</span>
              </label>
              <textarea
                value={finishNotes}
                onChange={e => setFinishNotes(e.target.value)}
                placeholder="Problemi nell'immobile, eventi, note generali…"
                rows={3}
                className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white resize-none transition-all focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              L&apos;orario di completamento verrà registrato e il tempo totale verrà calcolato automaticamente.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => { setShowFinishModal(false); setFinishNotes('') }} className="flex-1">
                Annulla
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleFinishCleaning} className="flex-1">
                Conferma
              </Button>
            </div>
          </div>
        </div>
      )}

      <Section title="1. Immobile e Personale" icon={<Building2 size={18} />} isOpen={open.imovel} onToggle={() => toggle('imovel')}>
        <Field label="Immobile" required full>
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} disabled={!canEdit} required={canEdit} className={inputCls}>
            {properties.length === 0 && <option value="">Nessun immobile disponibile</option>}
            {properties.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          {selectedProperty && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {selectedProperty.avg_cleaning_hours != null && (
                <span>Tempo Stimato: {selectedProperty.avg_cleaning_hours}h · </span>
              )}
              {selectedProperty.min_guests != null && selectedProperty.max_guests != null && (
                <span>Ospiti: {selectedProperty.min_guests}–{selectedProperty.max_guests}</span>
              )}
            </p>
          )}
        </Field>

        {!isCliente && (
          <>
            <Field label="Responsabile Pulizia">
              <select value={cleaningStaffId} onChange={e => setCleaningStaffId(e.target.value)} disabled={!canEdit} className={inputCls}>
                <option value="">— Non assegnato —</option>
                {staff.map(s => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
              </select>
            </Field>

            <Field label="Responsabile Consegna">
              <select value={consegnaStaffId} onChange={e => setConsegnaStaffId(e.target.value)} disabled={!canEdit} className={inputCls}>
                <option value="">— Non assegnato —</option>
                {staff.map(s => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section title="2. Dettagli Visita" icon={<CalendarDays size={18} />} isOpen={open.visita} onToggle={() => toggle('visita')}>
        <Field label="Data Pulizia" required>
          <input type="date" value={cleaningDate} onChange={e => setCleaningDate(e.target.value)} disabled={!canEdit} required={canEdit} className={inputCls} />
        </Field>

        <div />

        <Field label="Check-out Ospiti">
          <input type="datetime-local" value={checkoutAt} onChange={e => setCheckoutAt(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>

        <Field label="Check-in Prossimi Ospiti">
          <input type="datetime-local" value={checkinAt} onChange={e => setCheckinAt(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>

        {urgencyWarning && (
          <div className="sm:col-span-2 flex items-center gap-2 px-4 py-3 bg-urgent-bg border border-urgent/20 rounded-xl text-sm text-urgent font-medium">
            <Zap size={16} className="shrink-0" />
            Intervallo inferiore a 3 ore — questo O.L. sarà contrassegnato come <strong className="ml-1">Urgente</strong>.
          </div>
        )}
      </Section>

      <Section title="3. Occupazione Effettiva" icon={<Users size={18} />} isOpen={open.ocupacao} onToggle={() => toggle('ocupacao')}>
        <Field
          label={
            <>
              Ospiti Effettivi
              {(selectedProperty?.min_guests != null || selectedProperty?.max_guests != null) && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {selectedProperty.min_guests != null && selectedProperty.max_guests != null
                    ? `(min ${selectedProperty.min_guests} / max ${selectedProperty.max_guests})`
                    : selectedProperty.max_guests != null
                    ? `(max ${selectedProperty.max_guests})`
                    : `(min ${selectedProperty.min_guests})`}
                </span>
              )}
            </>
          }
          full
        >
          <input type="number" min="0" value={realGuests} onChange={e => setRealGuests(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Letti Matrimoniali
              {selectedProperty?.double_beds != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.double_beds})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={doubleBeds} onChange={e => setDoubleBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Letti Singoli
              {selectedProperty?.single_beds != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.single_beds})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={singleBeds} onChange={e => setSingleBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Divani Letto
              {selectedProperty?.sofa_beds != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.sofa_beds})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={sofaBeds} onChange={e => setSofaBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Poltrone Letto
              {selectedProperty?.armchair_beds != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.armchair_beds})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={armchairBeds} onChange={e => setArmchairBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Bagni
              {selectedProperty?.bathrooms != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.bathrooms})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={bathrooms} onChange={e => setBathrooms(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Bidet
              {selectedProperty?.bidets != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.bidets})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={bidets} onChange={e => setBidets(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field
          label={
            <>
              Culle
              {selectedProperty?.cribs != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.cribs})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={cribs} onChange={e => setCribs(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
      </Section>

      {/* Tópico 4: Note sulla pulizia — apenas admin/secretaria */}
      {isAdminOrSec && (
        <Section title="4. Note sulla Pulizia" icon={<ClipboardList size={18} />} isOpen={open.obsLimpeza} onToggle={() => toggle('obsLimpeza')}>
          <Field label="Note" full>
            <textarea
              value={cleaningNotes}
              onChange={e => setCleaningNotes(e.target.value)}
              placeholder="Indicazioni del cliente, punti di attenzione, richieste speciali di pulizia…"
              rows={4}
              disabled={!canEdit}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>
      )}

      {/* Tópico 5: Servizi extra — apenas admin/secretaria, editável mesmo após finalização */}
      {isAdminOrSec && (
        <Section title="5. Servizi Extra" icon={<PlusCircle size={18} />} isOpen={open.extras} onToggle={() => toggle('extras')}>
          <Field label="Modalità di Prezzo" full>
            <PricingModeSelector
              value={pricingMode}
              onChange={setPricingMode}
              disabled={!canEdit && !canEditExtras}
              basePrice={role === 'admin' ? selectedProperty?.base_price ?? null : null}
              canViewPricing={role === 'admin'}
            />
          </Field>
          <Field label="Descrizione dei servizi" full>
            <textarea
              value={extraDesc}
              onChange={e => setExtraDesc(e.target.value)}
              placeholder="Descrivi i servizi aggiuntivi effettuati…"
              rows={3}
              disabled={!canEdit && !canEditExtras}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="Valore extra manuale (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraPrice}
              onChange={e => setExtraPrice(e.target.value)}
              disabled={!canEdit && !canEditExtras}
              className={inputCls}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Somma aggiuntiva al valore calcolato dalla modalità selezionata.
            </p>
          </Field>
          {canEditExtras && (
            <div className="sm:col-span-2">
              <Button type="button" variant="accent" isLoading={isSavingExtras} onClick={handleSaveExtras}>
                {isSavingExtras ? 'Salvataggio…' : 'Salva Servizi Extra'}
              </Button>
            </div>
          )}
        </Section>
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
