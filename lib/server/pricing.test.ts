import { describe, expect, it } from 'vitest'
import { calculateTotalPrice } from './pricing'

describe('calculateTotalPrice', () => {
  it('uses base price plus extra guests and extra services for standard pricing', () => {
    expect(calculateTotalPrice('standard', 100, 12, 5, 2, 30)).toBe(166)
  })

  it('does not charge negative extra guests for standard pricing', () => {
    expect(calculateTotalPrice('standard', 100, 12, 1, 2, null)).toBe(100)
  })

  it('returns null for standard and ripasso pricing without base price', () => {
    expect(calculateTotalPrice('standard', null, 12, 5, 2, 30)).toBeNull()
    expect(calculateTotalPrice('ripasso', null, null, null, null, 30)).toBeNull()
  })

  it('uses 60 percent of base price plus extras for ripasso pricing', () => {
    expect(calculateTotalPrice('ripasso', 150, null, null, null, 10)).toBe(100)
  })

  it('uses worked minutes at the out long stay hourly rate plus extras', () => {
    expect(calculateTotalPrice('out_long_stay', null, null, null, null, 15, 90)).toBe(52.5)
  })

  it('returns null for out long stay pricing until worked minutes exist', () => {
    expect(calculateTotalPrice('out_long_stay', null, null, null, null, 15, null)).toBeNull()
  })
})
