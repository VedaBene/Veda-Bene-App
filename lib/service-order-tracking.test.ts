import { describe, expect, it } from 'vitest'
import {
  canOperateCleaningTracking,
  getCleaningTrackingAction,
  validateCleaningTrackingTransition,
} from './service-order-tracking'

describe('service-order cleaning tracking', () => {
  const assignedOrder = {
    cleaning_staff_id: null,
    cleaning_staff_ids: ['cleaner-1', 'cleaner-2'],
  }

  it('allows admin and secretaria to operate tracking on behalf of assigned staff', () => {
    expect(canOperateCleaningTracking('admin', 'admin-1', assignedOrder)).toBe(true)
    expect(canOperateCleaningTracking('secretaria', 'secretaria-1', assignedOrder)).toBe(true)
  })

  it('allows only assigned cleaning staff among operational roles', () => {
    expect(canOperateCleaningTracking('limpeza', 'cleaner-1', assignedOrder)).toBe(true)
    expect(canOperateCleaningTracking('limpeza', 'cleaner-3', assignedOrder)).toBe(false)
    expect(canOperateCleaningTracking('consegna', 'cleaner-1', assignedOrder)).toBe(false)
    expect(canOperateCleaningTracking('cliente', 'cleaner-1', assignedOrder)).toBe(false)
  })

  it('recovers an in-progress order whose timer was not started', () => {
    expect(getCleaningTrackingAction({
      status: 'in_progress',
      started_at: null,
      completed_at: null,
    })).toBe('start')
  })

  it('only permits finishing after a start timestamp exists', () => {
    const inProgress = {
      status: 'in_progress' as const,
      started_at: '2026-07-11T10:00:00Z',
      completed_at: null,
    }

    expect(getCleaningTrackingAction(inProgress)).toBe('finish')
    expect(validateCleaningTrackingTransition('finish', inProgress)).toBeNull()
    expect(validateCleaningTrackingTransition('start', inProgress)).toBe('La pulizia è già stata avviata.')
  })

  it('offers no tracking action after completion', () => {
    expect(getCleaningTrackingAction({
      status: 'done',
      started_at: '2026-07-11T10:00:00Z',
      completed_at: '2026-07-11T12:00:00Z',
    })).toBeNull()
  })
})
