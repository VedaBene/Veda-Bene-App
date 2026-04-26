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
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
}

const STATUS_VARIANT: Record<OSStatus, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
}

const PRICING_MODE_OPTIONS: { value: PricingMode; label: string; hint: string }[] = [
  { value: 'standard', label: 'Padrão', hint: 'Preço base + adicional por pessoa' },
  { value: 'ripasso', label: 'Ripasso', hint: '60% do preço base do imóvel' },
  { value: 'out_long_stay', label: 'Out Long Stay', hint: 'Tempo trabalhado × €25/h' },
]

function PricingModeSelector({
  value,
  onChange,
  disabled,
  basePrice,
}: {
  value: PricingMode
  onChange: (v: PricingMode) => void
  disabled: boolean
  basePrice: number | null
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
              <div className="text-xs text-muted-foreground mt-0.5">{opt.hint}</div>
            </button>
          )
        })}
      </div>
      {value === 'ripasso' && (
        <p className="text-xs text-muted-foreground">
          {basePrice != null
            ? <>Valor calculado: <strong className="text-foreground">€{(basePrice * 0.6).toFixed(2)}</strong> (60% de €{basePrice.toFixed(2)})</>
            : 'Defina o preço base no cadastro do imóvel para que o cálculo funcione.'}
        </p>
      )}
      {value === 'out_long_stay' && (
        <p className="text-xs text-muted-foreground">
          Valor será calculado ao finalizar a limpeza (tempo trabalhado × €25/h).
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
  deleteAction?: () => Promise<unknown>
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
    if (!window.confirm('Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita.')) return
    setIsDeleting(true)
    const result = await deleteAction()
    if (result && typeof result === 'object' && 'success' in result && !(result as { success: boolean }).success) {
      setError((result as { error: string }).error)
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
          <span className="text-sm text-muted-foreground font-medium">Status:</span>
          <Badge variant={STATUS_VARIANT[order.status]} label={STATUS_LABEL[order.status]} dot />
          <UrgencyBadge isUrgent={order.is_urgent} />
          {canEdit && (
            <div className="ml-auto flex gap-2">
              {order.status !== 'in_progress' && (
                <Button type="button" size="sm" variant="secondary" disabled={isUpdatingStatus} onClick={() => handleStatusChange('in_progress')}>
                  Em andamento
                </Button>
              )}
              {order.status !== 'done' && (
                <Button type="button" size="sm" variant="accent" disabled={isUpdatingStatus} onClick={() => handleStatusChange('done')}>
                  Finalizar
                </Button>
              )}
              {order.status !== 'open' && (
                <Button type="button" size="sm" variant="ghost" disabled={isUpdatingStatus} onClick={() => handleStatusChange('open')}>
                  Reabrir
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
            <span className="text-sm font-semibold text-foreground">Controle de Tempo</span>
          </div>

          {/* Open: show start button */}
          {order.status === 'open' && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">Clique abaixo para iniciar a limpeza e registrar o horário de início.</p>
              <Button type="button" variant="accent" icon={<Play size={15} />} onClick={() => setShowStartModal(true)}>
                Iniciar Limpeza
              </Button>
            </div>
          )}

          {/* In progress: show live timer + finish button */}
          {order.status === 'in_progress' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-info flex-1">
                <span className="text-xs text-muted-foreground">Em andamento há</span>
                {order.started_at
                  ? <LiveTimer startedAt={order.started_at} />
                  : <span className="text-sm font-medium">—</span>
                }
              </div>
              <Button type="button" variant="accent" icon={<Flag size={15} />} onClick={() => setShowFinishModal(true)}>
                Concluir Limpeza
              </Button>
            </div>
          )}

          {/* Done: show summary */}
          {order.status === 'done' && order.worked_minutes != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={15} className="text-success shrink-0" />
              Tempo total: <span className="font-semibold text-foreground">{formatWorkedTime(order.worked_minutes)}</span>
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
            <span className="text-sm font-semibold text-foreground">Resumo de Tempo</span>
          </div>
          {order.worked_minutes != null && (
            <p className="text-sm text-muted-foreground">
              Tempo trabalhado: <span className="font-semibold text-foreground">{formatWorkedTime(order.worked_minutes)}</span>
            </p>
          )}
          {order.completion_notes && (
            <p className="text-sm text-muted-foreground">
              Observações: <span className="text-foreground">{order.completion_notes}</span>
            </p>
          )}
        </div>
      )}

      {/* Modal: Iniciar Limpeza */}
      {showStartModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Iniciar Limpeza</h2>
              </div>
              <button type="button" onClick={() => setShowStartModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Imóvel</p>
              <p className="text-sm font-semibold text-foreground">{selectedProperty?.name ?? '—'}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Ao confirmar, o horário de início será registrado e o status da OS passará para <strong>Em andamento</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowStartModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleStartCleaning} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Concluir Limpeza */}
      {showFinishModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Concluir Limpeza</h2>
              </div>
              <button type="button" onClick={() => { setShowFinishModal(false); setFinishNotes('') }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Imóvel</p>
              <p className="text-sm font-semibold text-foreground">{selectedProperty?.name ?? '—'}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Observações <span className="normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                value={finishNotes}
                onChange={e => setFinishNotes(e.target.value)}
                placeholder="Problemas no imóvel, ocorrências, observações gerais…"
                rows={3}
                className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white resize-none transition-all focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              O horário de conclusão será registrado e o tempo total calculado automaticamente.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => { setShowFinishModal(false); setFinishNotes('') }} className="flex-1">
                Cancelar
              </Button>
              <Button type="button" variant="accent" isLoading={isTrackingAction} onClick={handleFinishCleaning} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      <Section title="1. Imóvel e Funcionários" icon={<Building2 size={18} />} isOpen={open.imovel} onToggle={() => toggle('imovel')}>
        <Field label="Imóvel" required full>
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} disabled={!canEdit} required={canEdit} className={inputCls}>
            {properties.length === 0 && <option value="">Nenhum imóvel disponível</option>}
            {properties.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          {selectedProperty && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {selectedProperty.avg_cleaning_hours != null && (
                <span>Tempo estimado: {selectedProperty.avg_cleaning_hours}h · </span>
              )}
              {selectedProperty.min_guests != null && selectedProperty.max_guests != null && (
                <span>Hóspedes: {selectedProperty.min_guests}–{selectedProperty.max_guests}</span>
              )}
            </p>
          )}
        </Field>

        {!isCliente && (
          <>
            <Field label="Responsável Limpeza">
              <select value={cleaningStaffId} onChange={e => setCleaningStaffId(e.target.value)} disabled={!canEdit} className={inputCls}>
                <option value="">— Não atribuído —</option>
                {staff.map(s => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
              </select>
            </Field>

            <Field label="Responsável Consegna">
              <select value={consegnaStaffId} onChange={e => setConsegnaStaffId(e.target.value)} disabled={!canEdit} className={inputCls}>
                <option value="">— Não atribuído —</option>
                {staff.map(s => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section title="2. Detalhes da Visita" icon={<CalendarDays size={18} />} isOpen={open.visita} onToggle={() => toggle('visita')}>
        <Field label="Data da Limpeza" required>
          <input type="date" value={cleaningDate} onChange={e => setCleaningDate(e.target.value)} disabled={!canEdit} required={canEdit} className={inputCls} />
        </Field>

        <div />

        <Field label="Checkout (saída dos hóspedes)">
          <input type="datetime-local" value={checkoutAt} onChange={e => setCheckoutAt(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>

        <Field label="Checkin (entrada dos próximos hóspedes)">
          <input type="datetime-local" value={checkinAt} onChange={e => setCheckinAt(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>

        {urgencyWarning && (
          <div className="sm:col-span-2 flex items-center gap-2 px-4 py-3 bg-urgent-bg border border-urgent/20 rounded-xl text-sm text-urgent font-medium">
            <Zap size={16} className="shrink-0" />
            Intervalo menor que 3 horas — esta OS será marcada como <strong className="ml-1">Urgente</strong>.
          </div>
        )}
      </Section>

      <Section title="3. Ocupação Real" icon={<Users size={18} />} isOpen={open.ocupacao} onToggle={() => toggle('ocupacao')}>
        <Field
          label={
            <>
              Hóspedes Reais
              {(selectedProperty?.min_guests != null || selectedProperty?.max_guests != null) && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {selectedProperty.min_guests != null && selectedProperty.max_guests != null
                    ? `(mín ${selectedProperty.min_guests} / máx ${selectedProperty.max_guests})`
                    : selectedProperty.max_guests != null
                    ? `(máx ${selectedProperty.max_guests})`
                    : `(mín ${selectedProperty.min_guests})`}
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
              Camas de Casal
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
              Camas de Solteiro
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
              Sofá-camas
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
              Poltrona-camas
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
              Banheiros
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
              Bidês
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
              Berços
              {selectedProperty?.cribs != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedProperty.cribs})</span>
              )}
            </>
          }
        >
          <input type="number" min="0" value={cribs} onChange={e => setCribs(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
      </Section>

      {/* Tópico 4: Observações de limpeza — apenas admin/secretaria */}
      {isAdminOrSec && (
        <Section title="4. Observações de Limpeza" icon={<ClipboardList size={18} />} isOpen={open.obsLimpeza} onToggle={() => toggle('obsLimpeza')}>
          <Field label="Observações" full>
            <textarea
              value={cleaningNotes}
              onChange={e => setCleaningNotes(e.target.value)}
              placeholder="Orientações do cliente, pontos de atenção, pedidos especiais de limpeza…"
              rows={4}
              disabled={!canEdit}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>
      )}

      {/* Tópico 5: Serviços extras — apenas admin/secretaria, editável mesmo após finalização */}
      {isAdminOrSec && (
        <Section title="5. Serviços Extras" icon={<PlusCircle size={18} />} isOpen={open.extras} onToggle={() => toggle('extras')}>
          <Field label="Modo de precificação" full>
            <PricingModeSelector
              value={pricingMode}
              onChange={setPricingMode}
              disabled={!canEdit && !canEditExtras}
              basePrice={selectedProperty?.base_price ?? null}
            />
          </Field>
          <Field label="Descrição dos serviços" full>
            <textarea
              value={extraDesc}
              onChange={e => setExtraDesc(e.target.value)}
              placeholder="Descreva os serviços adicionais realizados…"
              rows={3}
              disabled={!canEdit && !canEditExtras}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="Valor extra manual (€)">
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
              Soma por cima do valor calculado pelo modo selecionado.
            </p>
          </Field>
          {canEditExtras && (
            <div className="sm:col-span-2">
              <Button type="button" variant="accent" isLoading={isSavingExtras} onClick={handleSaveExtras}>
                {isSavingExtras ? 'Salvando…' : 'Salvar Serviços Extras'}
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
          OS salva com sucesso.
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <Button type="submit" isLoading={isPending} variant="accent">
            {isPending ? 'Salvando…' : order ? 'Salvar Alterações' : 'Criar OS'}
          </Button>

          {deleteAction && (
            <Button type="button" onClick={handleDelete} isLoading={isDeleting} variant="danger" size="sm">
              {isDeleting ? 'Excluindo…' : 'Excluir OS'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
