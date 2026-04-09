'use client'

import { useState, useTransition, useEffect } from 'react'
import { createServiceOrder, updateServiceOrder, updateServiceOrderStatus, deleteServiceOrder } from '@/app/(app)/service-orders/actions'
import { UrgencyBadge } from './UrgencyBadge'
import type { OSStatus, Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type StaffOption = Pick<Profile, 'id' | 'full_name'>
type PropertyOption = Pick<Property, 'id' | 'name' | 'avg_cleaning_hours' | 'min_guests' | 'max_guests'>

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left font-medium text-gray-700 transition-colors"
      >
        <span>{title}</span>
        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {children}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string
  required?: boolean
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'

const STATUS_LABEL: Record<OSStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Finalizada',
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

  // --- Seção 1: Imóvel e Funcionários ---
  const [propertyId, setPropertyId] = useState(order?.property_id ?? properties[0]?.id ?? '')
  const [cleaningStaffId, setCleaningStaffId] = useState(order?.cleaning_staff_id ?? '')
  const [consegnaStaffId, setConsegnaStaffId] = useState(order?.consegna_staff_id ?? '')

  const selectedProperty = properties.find(p => p.id === propertyId)

  // --- Seção 2: Detalhes da Visita ---
  const [cleaningDate, setCleaningDate] = useState(order?.cleaning_date ?? '')
  const [checkoutAt, setCheckoutAt] = useState(
    order?.checkout_at ? order.checkout_at.slice(0, 16) : '',
  )
  const [checkinAt, setCheckinAt] = useState(
    order?.checkin_at ? order.checkin_at.slice(0, 16) : '',
  )

  // Alerta de urgência em tempo real
  const [urgencyWarning, setUrgencyWarning] = useState(false)
  useEffect(() => {
    if (checkoutAt && checkinAt) {
      const hours = hoursUntil(checkoutAt, checkinAt)
      setUrgencyWarning(hours !== null && hours > 0 && hours < 4)
    } else {
      setUrgencyWarning(false)
    }
  }, [checkoutAt, checkinAt])

  // --- Seção 3: Ocupação ---
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
      {/* Status e urgência (modo edição) */}
      {order && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm text-gray-600">Status:</span>
          <span className="text-sm font-medium text-gray-800">{STATUS_LABEL[order.status]}</span>
          <UrgencyBadge isUrgent={order.is_urgent} />
          {canEdit && (
            <div className="ml-auto flex gap-2">
              {order.status !== 'in_progress' && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange('in_progress')}
                  className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  Em andamento
                </button>
              )}
              {order.status !== 'done' && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange('done')}
                  className="px-3 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Finalizar
                </button>
              )}
              {order.status !== 'open' && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange('open')}
                  className="px-3 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
                >
                  Reabrir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1. Imóvel e Funcionários */}
      <Section title="1. Imóvel e Funcionários" isOpen={open.imovel} onToggle={() => toggle('imovel')}>
        <Field label="Imóvel" required full>
          <select
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
            disabled={!canEdit}
            required={canEdit}
            className={inputCls}
          >
            {properties.length === 0 && (
              <option value="">Nenhum imóvel disponível</option>
            )}
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProperty && (
            <p className="mt-1 text-xs text-gray-500">
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
              <select
                value={cleaningStaffId}
                onChange={e => setCleaningStaffId(e.target.value)}
                disabled={!canEdit}
                className={inputCls}
              >
                <option value="">— Não atribuído —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Responsável Consegna">
              <select
                value={consegnaStaffId}
                onChange={e => setConsegnaStaffId(e.target.value)}
                disabled={!canEdit}
                className={inputCls}
              >
                <option value="">— Não atribuído —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Section>

      {/* 2. Detalhes da Visita */}
      <Section title="2. Detalhes da Visita" isOpen={open.visita} onToggle={() => toggle('visita')}>
        <Field label="Data da Limpeza" required>
          <input
            type="date"
            value={cleaningDate}
            onChange={e => setCleaningDate(e.target.value)}
            disabled={!canEdit}
            required={canEdit}
            className={inputCls}
          />
        </Field>

        <div /> {/* spacer */}

        <Field label="Checkout (saída dos hóspedes)">
          <input
            type="datetime-local"
            value={checkoutAt}
            onChange={e => setCheckoutAt(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </Field>

        <Field label="Checkin (entrada dos próximos hóspedes)">
          <input
            type="datetime-local"
            value={checkinAt}
            onChange={e => setCheckinAt(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </Field>

        {urgencyWarning && (
          <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Intervalo menor que 4 horas — esta OS será marcada como <strong className="ml-1">Urgente</strong>.
          </div>
        )}
      </Section>

      {/* 3. Ocupação Real */}
      <Section title="3. Ocupação Real" isOpen={open.ocupacao} onToggle={() => toggle('ocupacao')}>
        <Field label="Hóspedes Reais" full>
          <input
            type="number"
            min="0"
            value={realGuests}
            onChange={e => setRealGuests(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </Field>

        <Field label="Camas de Casal">
          <input type="number" min="0" value={doubleBeds} onChange={e => setDoubleBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field label="Camas de Solteiro">
          <input type="number" min="0" value={singleBeds} onChange={e => setSingleBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field label="Sofá-camas">
          <input type="number" min="0" value={sofaBeds} onChange={e => setSofaBeds(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field label="Banheiros">
          <input type="number" min="0" value={bathrooms} onChange={e => setBathrooms(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field label="Bidês">
          <input type="number" min="0" value={bidets} onChange={e => setBidets(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
        <Field label="Berços">
          <input type="number" min="0" value={cribs} onChange={e => setCribs(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
      </Section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-lg">
          OS salva com sucesso.
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? 'Salvando…' : order ? 'Salvar Alterações' : 'Criar OS'}
          </button>

          {deleteAction && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Excluindo…' : 'Excluir OS'}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
