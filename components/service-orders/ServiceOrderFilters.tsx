'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { ServiceOrderPropertyOption } from '@/lib/types/view-models'

export function ServiceOrderFilters({
  search,
  propertyId,
  startDate,
  endDate,
  properties,
  hasFilter,
  onSearchChange,
  onPropertyChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  search: string
  propertyId: string
  startDate: string
  endDate: string
  properties: ServiceOrderPropertyOption[]
  hasFilter: boolean
  onSearchChange: (value: string) => void
  onPropertyChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClear: () => void
}) {
  const propertyOptions = [
    { value: '', label: 'Tutti gli immobili' },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 w-full">
      <Input
        type="text"
        placeholder="Cerca per immobile..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        leftIcon={<Search size={16} />}
        className="max-w-xs w-full sm:w-auto"
      />

      <div className="w-full sm:w-auto min-w-[200px] max-w-xs">
        <Select
          options={propertyOptions}
          value={propertyId}
          onChange={(e) => onPropertyChange(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-xs font-medium text-muted-foreground">Dal:</span>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="max-w-[150px] w-full"
        />
        <span className="text-xs font-medium text-muted-foreground">Al:</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="max-w-[150px] w-full"
          min={startDate || undefined}
        />
      </div>

      {hasFilter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-10 px-2 shrink-0"
        >
          <X size={14} />
          Cancella
        </button>
      )}
    </div>
  )
}
