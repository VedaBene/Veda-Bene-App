'use client'

import { Button } from '@/components/ui/Button'
import type { OSStatus } from '@/lib/types/database'
import { UrgencyBadge } from './UrgencyBadge'
import { ServiceOrderStatusBadge } from './display'

export function ServiceOrderStatusControls({
  status,
  isUrgent,
  canEdit,
  isUpdating,
  onStatusChange,
}: {
  status: OSStatus
  isUrgent: boolean
  canEdit: boolean
  isUpdating: boolean
  onStatusChange: (status: OSStatus) => void
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-card">
      <span className="text-sm text-muted-foreground font-medium">Stato:</span>
      <ServiceOrderStatusBadge status={status} />
      <UrgencyBadge isUrgent={isUrgent} />
      {canEdit && (
        <div className="ml-auto flex gap-2">
          {status !== 'in_progress' && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isUpdating}
              onClick={() => onStatusChange('in_progress')}
            >
              In corso
            </Button>
          )}
          {status !== 'done' && (
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={isUpdating}
              onClick={() => onStatusChange('done')}
            >
              Completa
            </Button>
          )}
          {status !== 'open' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isUpdating}
              onClick={() => onStatusChange('open')}
            >
              Riapri
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
