import { describe, expect, it } from 'vitest'
import { getRomeDateOnly, getRomeMonthStartDateOnly } from './date-rome'

describe('Rome date-only helpers', () => {
  it('uses the Italian calendar day when UTC is still on the previous day', () => {
    const instant = new Date('2026-07-31T22:30:00.000Z')

    expect(getRomeDateOnly(instant)).toBe('2026-08-01')
    expect(getRomeMonthStartDateOnly(instant)).toBe('2026-08-01')
  })

  it('uses the Italian calendar day in winter time', () => {
    const instant = new Date('2026-01-31T23:30:00.000Z')

    expect(getRomeDateOnly(instant)).toBe('2026-02-01')
    expect(getRomeMonthStartDateOnly(instant)).toBe('2026-02-01')
  })
})
