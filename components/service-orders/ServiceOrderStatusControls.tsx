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
  onReopen,
}: {
  status: OSStatus
  isUrgent: boolean
  canEdit: boolean
  isUpdating: boolean
  onReopen: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-card">
      <span className="text-sm text-muted-foreground font-medium">Stato:</span>
      <ServiceOrderStatusBadge status={status} />
      <UrgencyBadge isUrgent={isUrgent} />
      {canEdit && status !== 'open' && (
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isUpdating}
            onClick={onReopen}
          >
            Riapri
          </Button>
        </div>
      )}
    </div>
  )
}
