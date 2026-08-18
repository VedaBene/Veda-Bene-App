import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAuthorizedOrderPricingContext: vi.fn(),
  persistAuthorizedServiceOrderTotalPrice: vi.fn(),
}))

vi.mock('@/lib/server/data-access/sensitive-data', () => mocks)

import { calculateTotalPrice, recalculateOrderPricing } from './pricing'

describe('calculateTotalPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('persists the recalculated total through the authorized server-only seam', async () => {
    mocks.loadAuthorizedOrderPricingContext.mockResolvedValue({
      propertyId: 'property-1',
      realGuests: 5,
      workedMinutes: null,
      pricingMode: 'standard',
      extraServicesPrice: 30,
      property: { base_price: 100, extra_per_person: 12, min_guests: 2 },
    })

    await expect(recalculateOrderPricing('order-1')).resolves.toBe(176)
    expect(mocks.persistAuthorizedServiceOrderTotalPrice).toHaveBeenCalledWith('order-1', 176)
  })
})
