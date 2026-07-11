import { describe, expect, it } from 'vitest'
import { compareServiceOrderPriority } from './ordering'

describe('compareServiceOrderPriority', () => {
  it('prioritizes the earlier cleaning date even when the later order has a shorter window', () => {
    const todayWithLongWindow = {
      cleaning_date: '2026-07-10',
      checkout_at: '2026-07-10T08:00:00Z',
      checkin_at: '2026-07-10T18:00:00Z',
      order_number: 1,
    }
    const tomorrowWithShortWindow = {
      cleaning_date: '2026-07-11',
      checkout_at: '2026-07-11T10:00:00Z',
      checkin_at: '2026-07-11T11:00:00Z',
      order_number: 2,
    }

    expect([tomorrowWithShortWindow, todayWithLongWindow].sort(compareServiceOrderPriority))
      .toEqual([todayWithLongWindow, tomorrowWithShortWindow])
  })

  it('uses the shortest cleaning window within the same date', () => {
    const longWindow = {
      cleaning_date: '2026-07-10',
      checkout_at: '2026-07-10T08:00:00Z',
      checkin_at: '2026-07-10T14:00:00Z',
      order_number: 1,
    }
    const shortWindow = {
      cleaning_date: '2026-07-10',
      checkout_at: '2026-07-10T10:00:00Z',
      checkin_at: '2026-07-10T12:00:00Z',
      order_number: 2,
    }

    expect([longWindow, shortWindow].sort(compareServiceOrderPriority))
      .toEqual([shortWindow, longWindow])
  })

  it('places missing dates and missing windows last, then uses the order number', () => {
    const orders = [
      { cleaning_date: null, order_number: 4 },
      { cleaning_date: '2026-07-10', order_number: 3 },
      { cleaning_date: '2026-07-10', order_number: 2 },
    ]

    expect(orders.sort(compareServiceOrderPriority).map(order => order.order_number)).toEqual([2, 3, 4])
  })
})
