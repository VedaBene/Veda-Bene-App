import { describe, expect, it } from 'vitest'
import { resolveOrderHours, resolveOrderPayableHours } from './hours'

describe('resolveOrderHours', () => {
  it('prefers tracked worked minutes over property averages', () => {
    expect(resolveOrderHours({ worked_minutes: 135 }, { avg_cleaning_hours: 4 })).toBe(2.25)
  })

  it('falls back to average cleaning hours when no worked minutes exist', () => {
    expect(resolveOrderHours({ worked_minutes: null }, { avg_cleaning_hours: 3.5 })).toBe(3.5)
  })

  it('returns zero when neither worked minutes nor property average exist', () => {
    expect(resolveOrderHours({ worked_minutes: null }, null)).toBe(0)
  })
})

describe('resolveOrderPayableHours', () => {
  it('uses the property average even when tracked worked minutes exist', () => {
    expect(resolveOrderPayableHours({ avg_cleaning_hours: 4 })).toBe(4)
  })

  it('returns zero when the property average is missing', () => {
    expect(resolveOrderPayableHours({ avg_cleaning_hours: null })).toBe(0)
    expect(resolveOrderPayableHours(null)).toBe(0)
  })
})
