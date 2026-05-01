'use client'

import { useState, useTransition } from 'react'
import { createProperty, updateProperty } from '@/app/(app)/properties/actions'
import { Section } from '@/components/ui/Section'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Building2, Ruler, BedDouble, Euro, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react'
import type { Role, Zone } from '@/lib/types/database'
import type { PropertyFormData } from '@/lib/types/view-models'

function applyItalianPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const national = digits.startsWith('39') ? digits.slice(2) : digits
  const capped = national.slice(0, 10)
  if (!capped) return ''
  if (capped.length <= 3) return `+39 ${capped}`
  if (capped.length <= 6) return `+39 ${capped.slice(0, 3)} ${capped.slice(3)}`
  return `+39 ${capped.slice(0, 3)} ${capped.slice(3, 6)} ${capped.slice(6)}`
}

const ZONES: Zone[] = [
  'Saint Peter', 'Piazza Navona', 'Trastevere Area', 'Colosseum',
  'Spanish Steps', 'Trevi Fountain', "Campo de'Fiori", 'Parioli',
  'Termini Station', 'Other areas',
]

const inputCls =
  'w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50'

function ModeToggle({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 cursor-pointer ${
            value === o.value
              ? 'bg-accent text-white border-accent shadow-card'
              : 'bg-white text-foreground border-input-border hover:bg-muted disabled:cursor-not-allowed'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SmallToggle({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-2 mb-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1 rounded-lg border transition-all duration-200 cursor-pointer ${
            value === o.value
              ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
              : 'border-input-border text-muted-foreground hover:bg-muted disabled:cursor-not-allowed'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PropertyForm({
  property,
  agencies,
  owners,
  role,
  deleteAction,
  readOnly = false,
}: {
  property?: PropertyFormData
  agencies: { id: string; name: string; email: string | null }[]
  owners: { id: string; name: string; email: string | null }[]
  role: Role
  deleteAction?: () => Promise<{ success: false; error: string } | void>
  readOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [open, setOpen] = useState({
    identification: true,
    metragem: false,
    capacidade: false,
    precificacao: false,
    observacoes: false,
  })
  function toggle(s: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [s]: !prev[s] }))
  }

  const [name, setName] = useState(property?.name ?? '')
  const [clientType, setClientType] = useState<'rental' | 'particular'>(
    property?.client_type ?? 'rental',
  )
  const [zone, setZone] = useState<Zone>(property?.zone ?? 'Saint Peter')
  const [phone, setPhone] = useState(property?.phone ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [zipCode, setZipCode] = useState(property?.zip_code ?? '')

  const [agencyMode, setAgencyMode] = useState<'existing' | 'new'>(
    property?.agency_id ? 'existing' : agencies.length === 0 ? 'new' : 'existing',
  )
  const [agencyId, setAgencyId] = useState(property?.agency_id ?? agencies[0]?.id ?? '')
  const [newAgencyName, setNewAgencyName] = useState('')
  const [newAgencyEmail, setNewAgencyEmail] = useState('')
  const [existingAgencyEmail, setExistingAgencyEmail] = useState('')

  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>(
    property?.owner_id ? 'existing' : owners.length === 0 ? 'new' : 'existing',
  )
  const [ownerId, setOwnerId] = useState(property?.owner_id ?? owners[0]?.id ?? '')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [existingOwnerEmail, setExistingOwnerEmail] = useState('')

  const selectedAgency = agencies.find((a) => a.id === agencyId)
  const selectedOwner = owners.find((o) => o.id === ownerId)
  const agencyEmailMissing =
    agencyMode === 'existing' && !!selectedAgency && !selectedAgency.email
  const ownerEmailMissing =
    ownerMode === 'existing' && !!selectedOwner && !selectedOwner.email

  const [sqmInterior, setSqmInterior] = useState(property?.sqm_interior?.toString() ?? '')
  const [sqmExterior, setSqmExterior] = useState(property?.sqm_exterior?.toString() ?? '')
  const [sqmTotal, setSqmTotal] = useState(property?.sqm_total?.toString() ?? '')

  const [minGuests, setMinGuests] = useState(property?.min_guests?.toString() ?? '')
  const [maxGuests, setMaxGuests] = useState(property?.max_guests?.toString() ?? '')
  const [doubleBeds, setDoubleBeds] = useState(property?.double_beds?.toString() ?? '0')
  const [singleBeds, setSingleBeds] = useState(property?.single_beds?.toString() ?? '0')
  const [sofaBeds, setSofaBeds] = useState(property?.sofa_beds?.toString() ?? '0')
  const [armchairBeds, setArmchairBeds] = useState(property?.armchair_beds?.toString() ?? '0')
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() ?? '0')
  const [bidets, setBidets] = useState(property?.bidets?.toString() ?? '0')
  const [cribs, setCribs] = useState(property?.cribs?.toString() ?? '0')
  const [bedrooms, setBedrooms] = useState(property?.bedrooms?.toString() ?? '0')

  const [basePrice, setBasePrice] = useState(property?.base_price?.toString() ?? '')
  const [extraPerPerson, setExtraPerPerson] = useState(
    property?.extra_per_person?.toString() ?? '',
  )
  const [avgCleaningHours, setAvgCleaningHours] = useState(
    property?.avg_cleaning_hours?.toString() ?? '',
  )

  const [notes, setNotes] = useState(property?.notes ?? '')

  const showPricing = role === 'admin'
  const showSensitiveInfo = role === 'admin' || role === 'secretaria'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('name', name)
    fd.set('client_type', clientType)
    fd.set('zone', zone)
    fd.set('phone', phone)
    fd.set('address', address)
    fd.set('zip_code', zipCode)

    if (clientType === 'rental') {
      if (agencyMode === 'existing') {
        fd.set('agency_id', agencyId)
        if (agencyEmailMissing && existingAgencyEmail.trim()) {
          fd.set('existing_agency_email', existingAgencyEmail.trim())
        }
      } else {
        fd.set('new_agency_name', newAgencyName)
        fd.set('new_agency_email', newAgencyEmail)
      }
    } else {
      if (ownerMode === 'existing') {
        fd.set('owner_id', ownerId)
        if (ownerEmailMissing && existingOwnerEmail.trim()) {
          fd.set('existing_owner_email', existingOwnerEmail.trim())
        }
      } else {
        fd.set('new_owner_name', newOwnerName)
        fd.set('new_owner_email', newOwnerEmail)
      }
    }

    fd.set('sqm_interior', sqmInterior)
    fd.set('sqm_exterior', sqmExterior)
    fd.set('sqm_total', sqmTotal)
    fd.set('min_guests', minGuests)
    fd.set('max_guests', maxGuests)
    fd.set('double_beds', doubleBeds)
    fd.set('single_beds', singleBeds)
    fd.set('sofa_beds', sofaBeds)
    fd.set('armchair_beds', armchairBeds)
    fd.set('bathrooms', bathrooms)
    fd.set('bidets', bidets)
    fd.set('cribs', cribs)
    fd.set('bedrooms', bedrooms)

    if (showPricing) {
      fd.set('base_price', basePrice)
      fd.set('extra_per_person', extraPerPerson)
      fd.set('avg_cleaning_hours', avgCleaningHours)
    }

    fd.set('notes', notes)

    startTransition(async () => {
      const result = property
        ? await updateProperty(property.id, fd)
        : await createProperty(fd)

      if (result && !result.success) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(true)
      }
    })
  }

  async function handleDelete() {
    if (!deleteAction) return
    if (
      !window.confirm(
        'Sei sicuro di voler eliminare questo immobile? Questa azione non può essere annullata.',
      )
    )
      return

    setIsDeleting(true)
    const result = await deleteAction()
    if (result && !result.success) {
      setError(result.error)
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <Section
        title="1. Anagrafica"
        icon={<Building2 size={18} />}
        isOpen={open.identification}
        onToggle={() => toggle('identification')}
      >
        <Field label="Nome" required full>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!readOnly} disabled={readOnly} className={inputCls} placeholder="Nome dell'immobile" />
        </Field>

        {showSensitiveInfo && (
          <Field label="Tipo di Cliente" required full>
            <ModeToggle
              options={[
                { value: 'rental', label: 'Agenzia' },
                { value: 'particular', label: 'Privato' },
              ]}
              value={clientType}
              onChange={(v) => setClientType(v as 'rental' | 'particular')}
              disabled={readOnly}
            />
          </Field>
        )}

        {showSensitiveInfo && clientType === 'rental' && (
          <Field label="Agenzia" full>
            {agencies.length > 0 && (
              <SmallToggle
                options={[
                  { value: 'existing', label: 'Seleziona esistente' },
                  { value: 'new', label: 'Crea nuova' },
                ]}
                value={agencyMode}
                onChange={(v) => setAgencyMode(v as 'existing' | 'new')}
                disabled={readOnly}
              />
            )}
            {agencyMode === 'existing' ? (
              <div className="space-y-2">
                <select value={agencyId} onChange={(e) => { setAgencyId(e.target.value); setExistingAgencyEmail('') }} disabled={readOnly} className={inputCls}>
                  {agencies.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
                {agencyEmailMissing && (
                  <div className="space-y-1">
                    <input
                      type="email"
                      value={existingAgencyEmail}
                      onChange={(e) => setExistingAgencyEmail(e.target.value)}
                      placeholder="Email"
                      className={inputCls}
                      disabled={readOnly}
                    />
                    <p className="text-xs text-muted-foreground">
                      Questa agenzia non ha un'email registrata. Compila per consentire l'accesso al cliente.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} placeholder="Nome dell'agenzia *" className={inputCls} disabled={readOnly} />
                <input type="email" value={newAgencyEmail} onChange={(e) => setNewAgencyEmail(e.target.value)} placeholder="Email" className={inputCls} disabled={readOnly} />
              </div>
            )}
          </Field>
        )}

        {showSensitiveInfo && clientType === 'particular' && (
          <Field label="Proprietario" full>
            {owners.length > 0 && (
              <SmallToggle
                options={[
                  { value: 'existing', label: 'Seleziona esistente' },
                  { value: 'new', label: 'Crea nuovo' },
                ]}
                value={ownerMode}
                onChange={(v) => setOwnerMode(v as 'existing' | 'new')}
                disabled={readOnly}
              />
            )}
            {ownerMode === 'existing' ? (
              <div className="space-y-2">
                <select value={ownerId} onChange={(e) => { setOwnerId(e.target.value); setExistingOwnerEmail('') }} disabled={readOnly} className={inputCls}>
                  {owners.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
                {ownerEmailMissing && (
                  <div className="space-y-1">
                    <input
                      type="email"
                      value={existingOwnerEmail}
                      onChange={(e) => setExistingOwnerEmail(e.target.value)}
                      placeholder="Email"
                      className={inputCls}
                      disabled={readOnly}
                    />
                    <p className="text-xs text-muted-foreground">
                      Questo proprietario non ha un'email registrata. Compila per consentire l'accesso al cliente.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="Nome del proprietario *" className={inputCls} disabled={readOnly} />
                <input type="email" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="Email" className={inputCls} disabled={readOnly} />
              </div>
            )}
          </Field>
        )}

        <Field label="Zona" required>
          <select value={zone} onChange={(e) => setZone(e.target.value as Zone)} disabled={readOnly} className={inputCls}>
            {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
          </select>
        </Field>

        {showSensitiveInfo && (
          <Field label="Telefono">
            <input type="text" value={phone} onChange={(e) => setPhone(applyItalianPhoneMask(e.target.value))} disabled={readOnly} className={inputCls} placeholder="+39 000 000 0000" />
          </Field>
        )}

        <Field label="Indirizzo" full>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>

        <Field label="CAP">
          <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
      </Section>

      <Section title="2. Metratura" icon={<Ruler size={18} />} isOpen={open.metragem} onToggle={() => toggle('metragem')}>
        <Field label="Interno (m²)">
          <input type="number" step="0.1" min="0" value={sqmInterior} onChange={(e) => setSqmInterior(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
        <Field label="Esterno (m²)">
          <input type="number" step="0.1" min="0" value={sqmExterior} onChange={(e) => setSqmExterior(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
        <Field label="Total (m²)">
          <input type="number" step="0.1" min="0" value={sqmTotal} onChange={(e) => setSqmTotal(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
      </Section>

      <Section title="3. Capacità e Struttura" icon={<BedDouble size={18} />} isOpen={open.capacidade} onToggle={() => toggle('capacidade')}>
        <Field label="Min. Ospiti"><input type="number" min="0" value={minGuests} onChange={(e) => setMinGuests(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Max. Ospiti"><input type="number" min="0" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Letti Matrimoniali"><input type="number" min="0" value={doubleBeds} onChange={(e) => setDoubleBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Letti Singoli"><input type="number" min="0" value={singleBeds} onChange={(e) => setSingleBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Divani Letto"><input type="number" min="0" value={sofaBeds} onChange={(e) => setSofaBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Poltrone Letto"><input type="number" min="0" value={armchairBeds} onChange={(e) => setArmchairBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Camere"><input type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Bagni"><input type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Bidet"><input type="number" min="0" value={bidets} onChange={(e) => setBidets(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Culle"><input type="number" min="0" value={cribs} onChange={(e) => setCribs(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
      </Section>

      {showPricing && (
        <Section title="4. Prezzi e Tempi" icon={<Euro size={18} />} isOpen={open.precificacao} onToggle={() => toggle('precificacao')}>
          <Field label="Prezzo Base (€)"><input type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
          <Field label="Supplemento per Persona (€)"><input type="number" step="0.01" min="0" value={extraPerPerson} onChange={(e) => setExtraPerPerson(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
          <Field label="Tempo Medio di Pulizia (h)"><input type="number" step="0.5" min="0" value={avgCleaningHours} onChange={(e) => setAvgCleaningHours(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        </Section>
      )}

      <Section title="5. Note" icon={<MessageSquare size={18} />} isOpen={open.observacoes} onToggle={() => toggle('observacoes')}>
        <Field label="Note" full>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={4} className={`${inputCls} resize-none`} placeholder="Note generali sull'immobile..." />
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
          Immobile salvato con successo.
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between pt-2">
          <Button type="submit" isLoading={isPending} variant="accent">
            {isPending ? 'Salvataggio…' : property ? 'Salva Modifiche' : 'Crea Immobile'}
          </Button>

          {deleteAction && (
            <Button type="button" onClick={handleDelete} isLoading={isDeleting} variant="danger" size="sm">
              {isDeleting ? 'Eliminazione…' : 'Elimina Immobile'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
