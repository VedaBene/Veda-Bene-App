'use client'

import { useState, useTransition } from 'react'
import { createProperty, updateProperty } from '@/app/(app)/properties/actions'
import { Section } from '@/components/ui/Section'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Building2, Ruler, BedDouble, Euro, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react'
import type { Agency, Owner, Property, Role, Zone } from '@/lib/types/database'

const ZONES: Zone[] = [
  'Saint Peter', 'Piazza Navona', 'Trastevere Area', 'Colosseum',
  'Spanish Steps', 'Trevi Fountain', "Campo de'Fiori", 'Parioli',
  'Termini Station', 'Other areas',
]

const inputCls =
  'w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50'

export function PropertyForm({
  property,
  agencies,
  owners,
  role,
  deleteAction,
  readOnly = false,
}: {
  property?: Property & { agency: Agency | null; owner: Owner | null }
  agencies: Agency[]
  owners: Owner[]
  role: Role
  deleteAction?: () => Promise<unknown>
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
  const [email, setEmail] = useState(property?.email ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [zipCode, setZipCode] = useState(property?.zip_code ?? '')

  const [agencyMode, setAgencyMode] = useState<'existing' | 'new'>(
    property?.agency_id ? 'existing' : agencies.length === 0 ? 'new' : 'existing',
  )
  const [agencyId, setAgencyId] = useState(property?.agency_id ?? agencies[0]?.id ?? '')
  const [newAgencyName, setNewAgencyName] = useState('')
  const [newAgencyEmail, setNewAgencyEmail] = useState('')
  const [newAgencyPhone, setNewAgencyPhone] = useState('')

  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>(
    property?.owner_id ? 'existing' : owners.length === 0 ? 'new' : 'existing',
  )
  const [ownerId, setOwnerId] = useState(property?.owner_id ?? owners[0]?.id ?? '')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [newOwnerPhone, setNewOwnerPhone] = useState('')

  const [sqmInterior, setSqmInterior] = useState(property?.sqm_interior?.toString() ?? '')
  const [sqmExterior, setSqmExterior] = useState(property?.sqm_exterior?.toString() ?? '')
  const [sqmTotal, setSqmTotal] = useState(property?.sqm_total?.toString() ?? '')

  const [minGuests, setMinGuests] = useState(property?.min_guests?.toString() ?? '')
  const [maxGuests, setMaxGuests] = useState(property?.max_guests?.toString() ?? '')
  const [doubleBeds, setDoubleBeds] = useState(property?.double_beds?.toString() ?? '0')
  const [singleBeds, setSingleBeds] = useState(property?.single_beds?.toString() ?? '0')
  const [sofaBeds, setSofaBeds] = useState(property?.sofa_beds?.toString() ?? '0')
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() ?? '0')
  const [bidets, setBidets] = useState(property?.bidets?.toString() ?? '0')
  const [cribs, setCribs] = useState(property?.cribs?.toString() ?? '0')

  const [basePrice, setBasePrice] = useState(property?.base_price?.toString() ?? '')
  const [extraPerPerson, setExtraPerPerson] = useState(
    property?.extra_per_person?.toString() ?? '',
  )
  const [avgCleaningHours, setAvgCleaningHours] = useState(
    property?.avg_cleaning_hours?.toString() ?? '',
  )

  const [notes, setNotes] = useState(property?.notes ?? '')

  const showPricing = role === 'admin' || role === 'secretaria'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('name', name)
    fd.set('client_type', clientType)
    fd.set('zone', zone)
    fd.set('phone', phone)
    fd.set('email', email)
    fd.set('address', address)
    fd.set('zip_code', zipCode)

    if (clientType === 'rental') {
      if (agencyMode === 'existing') {
        fd.set('agency_id', agencyId)
      } else {
        fd.set('new_agency_name', newAgencyName)
        fd.set('new_agency_email', newAgencyEmail)
        fd.set('new_agency_phone', newAgencyPhone)
      }
    } else {
      if (ownerMode === 'existing') {
        fd.set('owner_id', ownerId)
      } else {
        fd.set('new_owner_name', newOwnerName)
        fd.set('new_owner_email', newOwnerEmail)
        fd.set('new_owner_phone', newOwnerPhone)
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
    fd.set('bathrooms', bathrooms)
    fd.set('bidets', bidets)
    fd.set('cribs', cribs)

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
        'Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita.',
      )
    )
      return

    setIsDeleting(true)
    const result = await deleteAction()
    if (
      result &&
      typeof result === 'object' &&
      'success' in result &&
      !(result as { success: boolean }).success
    ) {
      setError((result as { error: string }).error)
      setIsDeleting(false)
    }
  }

  function ModeToggle({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (v: string) => void
  }) {
    return (
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={readOnly}
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
  }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (v: string) => void
  }) {
    return (
      <div className="flex gap-2 mb-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={readOnly}
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <Section
        title="1. Identificação"
        icon={<Building2 size={18} />}
        isOpen={open.identification}
        onToggle={() => toggle('identification')}
      >
        <Field label="Nome" required full>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!readOnly} disabled={readOnly} className={inputCls} placeholder="Nome do imóvel" />
        </Field>

        <Field label="Tipo de Cliente" required full>
          <ModeToggle
            options={[
              { value: 'rental', label: 'Rental' },
              { value: 'particular', label: 'Particular' },
            ]}
            value={clientType}
            onChange={(v) => setClientType(v as 'rental' | 'particular')}
          />
        </Field>

        {clientType === 'rental' && (
          <Field label="Agência" full>
            {agencies.length > 0 && (
              <SmallToggle
                options={[
                  { value: 'existing', label: 'Selecionar existente' },
                  { value: 'new', label: 'Criar nova' },
                ]}
                value={agencyMode}
                onChange={(v) => setAgencyMode(v as 'existing' | 'new')}
              />
            )}
            {agencyMode === 'existing' ? (
              <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} disabled={readOnly} className={inputCls}>
                {agencies.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} placeholder="Nome da agência *" className={inputCls} disabled={readOnly} />
                <input type="email" value={newAgencyEmail} onChange={(e) => setNewAgencyEmail(e.target.value)} placeholder="Email" className={inputCls} disabled={readOnly} />
                <input type="text" value={newAgencyPhone} onChange={(e) => setNewAgencyPhone(e.target.value)} placeholder="Telefone" className={inputCls} disabled={readOnly} />
              </div>
            )}
          </Field>
        )}

        {clientType === 'particular' && (
          <Field label="Proprietário" full>
            {owners.length > 0 && (
              <SmallToggle
                options={[
                  { value: 'existing', label: 'Selecionar existente' },
                  { value: 'new', label: 'Criar novo' },
                ]}
                value={ownerMode}
                onChange={(v) => setOwnerMode(v as 'existing' | 'new')}
              />
            )}
            {ownerMode === 'existing' ? (
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={readOnly} className={inputCls}>
                {owners.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="Nome do proprietário *" className={inputCls} disabled={readOnly} />
                <input type="email" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="Email" className={inputCls} disabled={readOnly} />
                <input type="text" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} placeholder="Telefone" className={inputCls} disabled={readOnly} />
              </div>
            )}
          </Field>
        )}

        <Field label="Zona" required>
          <select value={zone} onChange={(e) => setZone(e.target.value as Zone)} disabled={readOnly} className={inputCls}>
            {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
          </select>
        </Field>

        <Field label="Telefone">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} className={inputCls} placeholder="+39 000 0000000" />
        </Field>

        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>

        <Field label="Endereço" full>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>

        <Field label="CEP">
          <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
      </Section>

      <Section title="2. Metragem" icon={<Ruler size={18} />} isOpen={open.metragem} onToggle={() => toggle('metragem')}>
        <Field label="Interno (m²)">
          <input type="number" step="0.1" min="0" value={sqmInterior} onChange={(e) => setSqmInterior(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
        <Field label="Externo (m²)">
          <input type="number" step="0.1" min="0" value={sqmExterior} onChange={(e) => setSqmExterior(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
        <Field label="Total (m²)">
          <input type="number" step="0.1" min="0" value={sqmTotal} onChange={(e) => setSqmTotal(e.target.value)} disabled={readOnly} className={inputCls} />
        </Field>
      </Section>

      <Section title="3. Capacidade e Estrutura" icon={<BedDouble size={18} />} isOpen={open.capacidade} onToggle={() => toggle('capacidade')}>
        <Field label="Mín. Hóspedes"><input type="number" min="0" value={minGuests} onChange={(e) => setMinGuests(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Máx. Hóspedes"><input type="number" min="0" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Camas de Casal"><input type="number" min="0" value={doubleBeds} onChange={(e) => setDoubleBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Camas de Solteiro"><input type="number" min="0" value={singleBeds} onChange={(e) => setSingleBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Sofá-camas"><input type="number" min="0" value={sofaBeds} onChange={(e) => setSofaBeds(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Banheiros"><input type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Bidês"><input type="number" min="0" value={bidets} onChange={(e) => setBidets(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        <Field label="Berços"><input type="number" min="0" value={cribs} onChange={(e) => setCribs(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
      </Section>

      {showPricing && (
        <Section title="4. Precificação e Tempo" icon={<Euro size={18} />} isOpen={open.precificacao} onToggle={() => toggle('precificacao')}>
          <Field label="Preço Base (€)"><input type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
          <Field label="Adicional por Pessoa (€)"><input type="number" step="0.01" min="0" value={extraPerPerson} onChange={(e) => setExtraPerPerson(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
          <Field label="Tempo Médio de Limpeza (h)"><input type="number" step="0.5" min="0" value={avgCleaningHours} onChange={(e) => setAvgCleaningHours(e.target.value)} disabled={readOnly} className={inputCls} /></Field>
        </Section>
      )}

      <Section title="5. Observações" icon={<MessageSquare size={18} />} isOpen={open.observacoes} onToggle={() => toggle('observacoes')}>
        <Field label="Observações" full>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={4} className={`${inputCls} resize-none`} placeholder="Observações gerais sobre o imóvel..." />
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
          Imóvel salvo com sucesso.
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between pt-2">
          <Button type="submit" isLoading={isPending} variant="accent">
            {isPending ? 'Salvando…' : property ? 'Salvar Alterações' : 'Criar Imóvel'}
          </Button>

          {deleteAction && (
            <Button type="button" onClick={handleDelete} isLoading={isDeleting} variant="danger" size="sm">
              {isDeleting ? 'Excluindo…' : 'Excluir Imóvel'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
