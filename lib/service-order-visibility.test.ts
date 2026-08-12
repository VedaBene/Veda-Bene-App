import { describe, expect, it } from 'vitest'
import {
  getOperationalServiceOrderVisibility,
  isOperationalStaffRole,
} from './service-order-visibility'

describe('operational service-order visibility', () => {
  it('recognizes only Pulizia and Consegna as operational staff', () => {
    expect(isOperationalStaffRole('limpeza')).toBe(true)
    expect(isOperationalStaffRole('consegna')).toBe(true)
    expect(isOperationalStaffRole('admin')).toBe(false)
    expect(isOperationalStaffRole('secretaria')).toBe(false)
    expect(isOperationalStaffRole('cliente')).toBe(false)
  })

  it('uses the Rome calendar when UTC is still on the previous day', () => {
    expect(getOperationalServiceOrderVisibility('2026-07-31T22:30:00.000Z')).toEqual({
      today: '2026-08-01',
      maxVisibleDate: '2026-08-01',
    })
  })

  it('keeps the maximum visible date on today around daylight saving time', () => {
    expect(getOperationalServiceOrderVisibility('2026-03-29T22:30:00.000Z')).toEqual({
      today: '2026-03-30',
      maxVisibleDate: '2026-03-30',
    })
    expect(getOperationalServiceOrderVisibility('2026-10-25T23:30:00.000Z')).toEqual({
      today: '2026-10-26',
      maxVisibleDate: '2026-10-26',
    })
  })
})
