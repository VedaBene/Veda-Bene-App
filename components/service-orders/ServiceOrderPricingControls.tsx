'use client'

import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Section } from '@/components/ui/Section'
import type { PricingMode } from '@/lib/types/database'

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

export function PricingModeSelector({
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

export function ServiceOrderExtrasSection({
  isOpen,
  onToggle,
  pricingMode,
  onPricingModeChange,
  extraDescription,
  onExtraDescriptionChange,
  extraPrice,
  onExtraPriceChange,
  disabled,
  basePrice,
  canViewPricing,
  canSaveExtras,
  isSavingExtras,
  onSaveExtras,
}: {
  isOpen: boolean
  onToggle: () => void
  pricingMode: PricingMode
  onPricingModeChange: (mode: PricingMode) => void
  extraDescription: string
  onExtraDescriptionChange: (value: string) => void
  extraPrice: string
  onExtraPriceChange: (value: string) => void
  disabled: boolean
  basePrice: number | null
  canViewPricing: boolean
  canSaveExtras: boolean
  isSavingExtras: boolean
  onSaveExtras: () => void
}) {
  return (
    <Section title="5. Servizi Extra" icon={<PlusCircle size={18} />} isOpen={isOpen} onToggle={onToggle}>
      <Field label="Modalità di Prezzo" full>
        <PricingModeSelector
          value={pricingMode}
          onChange={onPricingModeChange}
          disabled={disabled}
          basePrice={basePrice}
          canViewPricing={canViewPricing}
        />
      </Field>
      <Field label="Descrizione dei servizi" full>
        <textarea
          value={extraDescription}
          onChange={e => onExtraDescriptionChange(e.target.value)}
          placeholder="Descrivi i servizi aggiuntivi effettuati…"
          rows={3}
          disabled={disabled}
          className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50 resize-none"
        />
      </Field>
      <Field label="Valore extra manuale (€)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={extraPrice}
          onChange={e => onExtraPriceChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white transition-all duration-200 focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none placeholder:text-muted-foreground/50"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Somma aggiuntiva al valore calcolato dalla modalità selezionata.
        </p>
      </Field>
      {canSaveExtras && (
        <div className="sm:col-span-2">
          <Button type="button" variant="accent" isLoading={isSavingExtras} onClick={onSaveExtras}>
            {isSavingExtras ? 'Salvataggio…' : 'Salva Servizi Extra'}
          </Button>
        </div>
      )}
    </Section>
  )
}
