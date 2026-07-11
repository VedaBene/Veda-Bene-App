'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { StaffOption } from '@/lib/types/view-models'

export function ServiceOrderFilters({
  search,
  cleaningStaffId,
  consegnaStaffId,
  startDate,
  endDate,
  staff,
  hasFilter,
  onSearchChange,
  onCleaningStaffChange,
  onConsegnaStaffChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  search: string
  cleaningStaffId: string
  consegnaStaffId: string
  startDate: string
  endDate: string
  staff: StaffOption[]
  hasFilter: boolean
  onSearchChange: (value: string) => void
  onCleaningStaffChange: (value: string) => void
  onConsegnaStaffChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClear: () => void
}) {
  const cleaningOptions = [
    { value: '', label: 'Tutti — Pulizia' },
    ...staff.filter((person) => person.role === 'limpeza').map((person) => ({ value: person.id, label: person.full_name })),
  ]
  const consegnaOptions = [
    { value: '', label: 'Tutti — Consegna' },
    ...staff.filter((person) => person.role === 'consegna').map((person) => ({ value: person.id, label: person.full_name })),
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

      {staff.length > 0 && <div className="w-full sm:w-auto min-w-[190px] max-w-xs">
        <Select
          options={cleaningOptions}
          value={cleaningStaffId}
          onChange={(e) => onCleaningStaffChange(e.target.value)}
          aria-label="Responsabile Pulizia"
          className="w-full"
        />
      </div>}

      {staff.length > 0 && <div className="w-full sm:w-auto min-w-[190px] max-w-xs">
        <Select
          options={consegnaOptions}
          value={consegnaStaffId}
          onChange={(e) => onConsegnaStaffChange(e.target.value)}
          aria-label="Responsabile Consegna"
          className="w-full"
        />
      </div>}

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
