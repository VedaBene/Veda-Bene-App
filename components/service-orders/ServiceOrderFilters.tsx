'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export function ServiceOrderFilters({
  search,
  date,
  hasFilter,
  onSearchChange,
  onDateChange,
  onClear,
}: {
  search: string
  date: string
  hasFilter: boolean
  onSearchChange: (value: string) => void
  onDateChange: (value: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="text"
        placeholder="Cerca per immobile..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        leftIcon={<Search size={16} />}
        className="max-w-xs"
      />
      <Input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="max-w-[180px]"
      />
      {hasFilter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
          Cancella
        </button>
      )}
    </div>
  )
}
