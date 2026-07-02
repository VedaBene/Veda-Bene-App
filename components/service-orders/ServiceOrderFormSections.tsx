'use client'

import { Building2, CalendarDays, ClipboardList, Trash2, Users, Zap } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Section } from '@/components/ui/Section'
import type { ServiceOrderPropertyOption, StaffOption } from '@/lib/types/view-models'
import { formatDate } from './display'

export const inputCls =
  'w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50'

export function PropertyStaffSection({
  isOpen,
  onToggle,
  propertyId,
  onPropertyIdChange,
  cleaningStaffIds,
  onCleaningStaffIdsChange,
  consegnaStaffId,
  onConsegnaStaffIdChange,
  properties,
  staff,
  selectedProperty,
  canEdit,
  isCliente,
  lastCleaning,
}: {
  isOpen: boolean
  onToggle: () => void
  propertyId: string
  onPropertyIdChange: (value: string) => void
  cleaningStaffIds: string[]
  onCleaningStaffIdsChange: (value: string[]) => void
  consegnaStaffId: string
  onConsegnaStaffIdChange: (value: string) => void
  properties: ServiceOrderPropertyOption[]
  staff: StaffOption[]
  selectedProperty?: ServiceOrderPropertyOption
  canEdit: boolean
  isCliente: boolean
  lastCleaning?: {
    orderNumber: number
    date: string
    staffName: string
  } | null
}) {
  return (
    <Section title="1. Immobile e Personale" icon={<Building2 size={18} />} isOpen={isOpen} onToggle={onToggle}>
      <Field label="Immobile" required full>
        <select value={propertyId} onChange={e => onPropertyIdChange(e.target.value)} disabled={!canEdit} required={canEdit} className={inputCls}>
          <option value="">— Seleziona un immobile —</option>
          {properties.length === 0 && <option value="" disabled>Nessun immobile disponibile</option>}
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
            {lastCleaning && (
              <span>
                {" · "}
                Ultima pulizia: <strong className="font-semibold text-foreground/80">#{lastCleaning.orderNumber}</strong> ({formatDate(lastCleaning.date)}) da <strong className="font-semibold text-foreground/80">{lastCleaning.staffName}</strong>
              </span>
            )}
          </p>
        )}
      </Field>

      {!isCliente && (
        <>
          <Field label="Responsabile Pulizia" full>
            <div className="space-y-2">
              {(cleaningStaffIds.length === 0 ? [''] : cleaningStaffIds).map((id, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={id}
                    onChange={e => {
                      const newIds = cleaningStaffIds.length === 0 ? [''] : [...cleaningStaffIds]
                      newIds[index] = e.target.value
                      onCleaningStaffIdsChange(newIds.filter(Boolean))
                    }}
                    disabled={!canEdit}
                    className={inputCls}
                  >
                    <option value="">— Non assegnato —</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  {canEdit && cleaningStaffIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newIds = cleaningStaffIds.filter((_, i) => i !== index)
                        onCleaningStaffIdsChange(newIds)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Rimuovi"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && cleaningStaffIds.length < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    onCleaningStaffIdsChange([...cleaningStaffIds, ''])
                  }}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1 mt-1"
                >
                  + Aggiungi dipendente
                </button>
              )}
            </div>
          </Field>

          <Field label="Responsabile Consegna">
            <select value={consegnaStaffId} onChange={e => onConsegnaStaffIdChange(e.target.value)} disabled={!canEdit} className={inputCls}>
              <option value="">— Non assegnato —</option>
              {staff.map(s => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
            </select>
          </Field>
        </>
      )}
    </Section>
  )
}

export function VisitDetailsSection({
  isOpen,
  onToggle,
  cleaningDate,
  onCleaningDateChange,
  checkoutAt,
  onCheckoutAtChange,
  checkinAt,
  onCheckinAtChange,
  canEdit,
  urgencyWarning,
}: {
  isOpen: boolean
  onToggle: () => void
  cleaningDate: string
  onCleaningDateChange: (value: string) => void
  checkoutAt: string
  onCheckoutAtChange: (value: string) => void
  checkinAt: string
  onCheckinAtChange: (value: string) => void
  canEdit: boolean
  urgencyWarning: boolean
}) {
  return (
    <Section title="2. Dettagli Visita" icon={<CalendarDays size={18} />} isOpen={isOpen} onToggle={onToggle}>
      <Field label="Data Pulizia">
        <input type="date" value={cleaningDate} onChange={e => onCleaningDateChange(e.target.value)} disabled={!canEdit} className={inputCls} />
      </Field>

      <div />

      <Field label="Check-out Ospiti">
        <input type="datetime-local" value={checkoutAt} onChange={e => onCheckoutAtChange(e.target.value)} disabled={!canEdit} className={inputCls} />
      </Field>

      <Field label="Check-in Prossimi Ospiti">
        <input type="datetime-local" value={checkinAt} onChange={e => onCheckinAtChange(e.target.value)} disabled={!canEdit} className={inputCls} />
      </Field>

      {urgencyWarning && (
        <div className="sm:col-span-2 flex items-center gap-2 px-4 py-3 bg-urgent-bg border border-urgent/20 rounded-xl text-sm text-urgent font-medium">
          <Zap size={16} className="shrink-0" />
          Intervallo inferiore a 3 ore — questo O.L. sarà contrassegnato come <strong className="ml-1">Urgente</strong>.
        </div>
      )}
    </Section>
  )
}

type OccupancyKey = 'realGuests' | 'doubleBeds' | 'singleBeds' | 'sofaBeds' | 'armchairBeds' | 'bathrooms' | 'bidets' | 'cribs'

type OccupancyField = {
  label: string
  value: string
  baseline?: number | null
  onChange: (value: string) => void
}

export function OccupancySection({
  isOpen,
  onToggle,
  canEdit,
  selectedProperty,
  values,
  setters,
}: {
  isOpen: boolean
  onToggle: () => void
  canEdit: boolean
  selectedProperty?: ServiceOrderPropertyOption
  values: Record<OccupancyKey, string>
  setters: Record<OccupancyKey, (value: string) => void>
}) {
  const fields: OccupancyField[] = [
    { label: 'Letti Matrimoniali', value: values.doubleBeds, baseline: selectedProperty?.double_beds, onChange: setters.doubleBeds },
    { label: 'Letti Singoli', value: values.singleBeds, baseline: selectedProperty?.single_beds, onChange: setters.singleBeds },
    { label: 'Divani Letto', value: values.sofaBeds, baseline: selectedProperty?.sofa_beds, onChange: setters.sofaBeds },
    { label: 'Poltrone Letto', value: values.armchairBeds, baseline: selectedProperty?.armchair_beds, onChange: setters.armchairBeds },
    { label: 'Bagni', value: values.bathrooms, baseline: selectedProperty?.bathrooms, onChange: setters.bathrooms },
    { label: 'Bidet', value: values.bidets, baseline: selectedProperty?.bidets, onChange: setters.bidets },
    { label: 'Culle', value: values.cribs, baseline: selectedProperty?.cribs, onChange: setters.cribs },
  ]

  return (
    <Section title="3. Occupazione Effettiva" icon={<Users size={18} />} isOpen={isOpen} onToggle={onToggle}>
      <Field label={<RealGuestsLabel selectedProperty={selectedProperty} />} full>
        <input type="number" min="0" value={values.realGuests} onChange={e => setters.realGuests(e.target.value)} disabled={!canEdit} className={inputCls} />
      </Field>
      {fields.map(field => (
        <Field key={field.label} label={<BaselineLabel label={field.label} baseline={field.baseline} />}>
          <input type="number" min="0" value={field.value} onChange={e => field.onChange(e.target.value)} disabled={!canEdit} className={inputCls} />
        </Field>
      ))}
    </Section>
  )
}

function RealGuestsLabel({ selectedProperty }: { selectedProperty?: ServiceOrderPropertyOption }) {
  return (
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
  )
}

function BaselineLabel({ label, baseline }: { label: string; baseline?: number | null }) {
  return (
    <>
      {label}
      {baseline != null && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">({baseline})</span>
      )}
    </>
  )
}

export function CleaningNotesSection({
  isOpen,
  onToggle,
  value,
  onChange,
  canEdit,
}: {
  isOpen: boolean
  onToggle: () => void
  value: string
  onChange: (value: string) => void
  canEdit: boolean
}) {
  return (
    <Section title="4. Note sulla Pulizia" icon={<ClipboardList size={18} />} isOpen={isOpen} onToggle={onToggle}>
      <Field label="Note" full>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Indicazioni del cliente, punti di attenzione, richieste speciali di pulizia…"
          rows={4}
          disabled={!canEdit}
          className={`${inputCls} resize-none`}
        />
      </Field>
    </Section>
  )
}
