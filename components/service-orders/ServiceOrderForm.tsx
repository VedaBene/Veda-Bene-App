'use client'

import { useState, useTransition, useEffect } from 'react'
import { createServiceOrder, updateServiceOrder, updateServiceOrderStatus, deleteServiceOrder } from '@/app/(app)/service-orders/actions'
import { UrgencyBadge } from './UrgencyBadge'
import { Section } from '@/components/ui/Section'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Building2, CalendarDays, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import type { OSStatus, Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type StaffOption = Pick<Profile, 'id' | 'full_name'>
type PropertyOption = Pick<
  Property,
  | 'id'
  | 'name'
  | 'avg_cleaning_hours'
  | 'min_guests'
  | 'max_guests'
  | 'double_beds'
  | 'single_beds'
  | 'sofa_beds'
  | 'bathrooms'
  | 'bidets'
  | 'cribs'
>

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
  deleteAction,
  readOnly = false,
}: {
  order?: ServiceOrder
  properties: PropertyOption[]
  staff: StaffOption[]
  role: Role
  deleteAction?: () => Promise<unknown>
  readOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [open, setOpen] = useState({ imovel: true, visita: true, ocupacao: false })
  function toggle(s: keyof typeof open) {
    setOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const isCliente = role === 'cliente'
  const canEdit = ['admin', 'secretaria'].includes(role) && !readOnly

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

  const [urgencyWarning, setUrgencyWarning] = useState(false)
  useEffect(() => {
    if (checkoutAt && checkinAt) {
      const hours = hoursUntil(checkoutAt, checkinAt)
      setUrgencyWarning(hours !== null && hours > 0 && hours < 4)
    } else {
      setUrgencyWarning(false)
    }
  }, [checkoutAt, checkinAt])

  const [realGuests, setRealGuests] = useState(order?.real_guests?.toString() ?? '')
  const [doubleBeds, setDoubleBeds] = useState(order?.double_beds?.toString() ?? '0')
  const [singleBeds, setSingleBeds] = useState(order?.single_beds?.toString() ?? '0')
  const [sofaBeds, setSofaBeds] = useState(order?.sofa_beds?.toString() ?? '0')
  const [bathrooms, setBathrooms] = useState(order?.bathrooms?.toString() ?? '0')
  const [bidets, setBidets] = useState(order?.bidets?.toString() ?? '0')
  const [cribs, setCribs] = useState(order?.cribs?.toString() ?? '0')

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
    fd.set('bathrooms', bathrooms)
    fd.set('bidets', bidets)
    fd.set('cribs', cribs)

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
            Intervalo menor que 4 horas — esta OS será marcada como <strong className="ml-1">Urgente</strong>.
          </div>
        )}
      </Section>

      <Section title="3. Ocupação Real" icon={<Users size={18} />} isOpen={open.ocupacao} onToggle={() => toggle('ocupacao')}>
        <Field
          label={
            <>
              Hóspedes Reais
              {selectedProperty?.max_guests != null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (máx {selectedProperty.max_guests})
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
