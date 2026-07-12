import type { OSStatus, Role } from '@/lib/types/database'

type TrackingOrder = {
  status: OSStatus
  started_at?: string | null
  completed_at?: string | null
  cleaning_staff_id?: string | null
  cleaning_staff_ids?: string[] | null
}

export type CleaningTrackingAction = 'start' | 'finish' | null

export function canOperateCleaningTracking(
  role: Role,
  userId: string | undefined,
  order: Pick<TrackingOrder, 'cleaning_staff_id' | 'cleaning_staff_ids'>,
): boolean {
  if (role === 'admin' || role === 'secretaria') return true
  if (role !== 'limpeza' || !userId) return false

  return order.cleaning_staff_ids?.includes(userId) || order.cleaning_staff_id === userId
}

export function getCleaningTrackingAction(
  order: Pick<TrackingOrder, 'status' | 'started_at' | 'completed_at'>,
): CleaningTrackingAction {
  if (order.completed_at || order.status === 'done') return null
  if (!order.started_at && (order.status === 'open' || order.status === 'in_progress')) return 'start'
  if (order.status === 'in_progress' && order.started_at) return 'finish'
  return null
}

export function validateCleaningTrackingTransition(
  action: Exclude<CleaningTrackingAction, null>,
  order: Pick<TrackingOrder, 'status' | 'started_at' | 'completed_at'>,
): string | null {
  const availableAction = getCleaningTrackingAction(order)
  if (availableAction === action) return null

  if (action === 'start') {
    return order.started_at
      ? 'La pulizia è già stata avviata.'
      : 'La pulizia non può essere avviata nello stato attuale.'
  }

  return !order.started_at
    ? 'Avvia la pulizia prima di completarla.'
    : 'La pulizia non può essere completata nello stato attuale.'
}
