import { describe, expect, it } from 'vitest'
import { calculateTotalPrice } from './pricing'

describe('calculateTotalPrice', () => {
  it('includes the fixed delivery fee in standard pricing', () => {
    expect(calculateTotalPrice('standard', 100, 12, 5, 2, 30)).toBe(176)
  })

  it('does not charge negative extra guests for standard pricing', () => {
    expect(calculateTotalPrice('standard', 100, 12, 1, 2, null)).toBe(110)
  })

  it('returns null for standard and ripasso pricing without base price', () => {
    expect(calculateTotalPrice('standard', null, 12, 5, 2, 30)).toBeNull()
    expect(calculateTotalPrice('ripasso', null, null, null, null, 30)).toBeNull()
  })

  it('includes the fixed delivery fee in ripasso pricing', () => {
    expect(calculateTotalPrice('ripasso', 150, null, null, null, 10)).toBe(110)
  })

  it('includes the fixed delivery fee in out long stay pricing', () => {
    expect(calculateTotalPrice('out_long_stay', null, null, null, null, 15, 90)).toBe(62.5)
  })

  it('returns null for out long stay pricing until worked minutes exist', () => {
    expect(calculateTotalPrice('out_long_stay', null, null, null, null, 15, null)).toBeNull()
  })
})
