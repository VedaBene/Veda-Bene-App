import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  getOperationalServiceOrderWindow,
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
    expect(getOperationalServiceOrderWindow('2026-07-31T22:30:00.000Z')).toEqual({
      today: '2026-08-01',
      tomorrow: '2026-08-02',
    })
  })

  it('advances by calendar day across year boundaries', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('does not depend on a fixed 24-hour Rome offset around daylight saving time', () => {
    expect(getOperationalServiceOrderWindow('2026-03-29T22:30:00.000Z')).toEqual({
      today: '2026-03-30',
      tomorrow: '2026-03-31',
    })
    expect(getOperationalServiceOrderWindow('2026-10-25T23:30:00.000Z')).toEqual({
      today: '2026-10-26',
      tomorrow: '2026-10-27',
    })
  })
})
