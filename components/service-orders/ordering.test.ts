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

  it('sorts by first cleaning staff alphabetically (A-Z) and places unassigned orders at the end', () => {
    const orderCarlos = {
      order_number: 105,
      cleaning_staff: [{ full_name: 'Carlos' }],
      cleaning_date: '2026-07-10',
    }
    const orderAndy = {
      order_number: 101,
      cleaning_staff: [{ full_name: 'Andy' }],
      cleaning_date: '2026-07-11', // later date, but Andy comes before Carlos
    }
    const orderBruno = {
      order_number: 103,
      cleaning_staff: [{ full_name: 'Bruno' }, { full_name: 'Zelda' }], // uses first staff 'Bruno'
      cleaning_date: '2026-07-10',
    }
    const orderUnassigned = {
      order_number: 99,
      cleaning_staff: [],
      cleaning_date: '2026-07-09', // earlier date, but has no staff assigned so goes last
    }

    const input = [orderCarlos, orderUnassigned, orderAndy, orderBruno]
    const sorted = [...input].sort(compareServiceOrderPriority)

    expect(sorted.map(o => o.order_number)).toEqual([101, 103, 105, 99])
  })

  it('sorts unassigned orders among themselves by date, window, and order_number', () => {
    const unassignedLate = {
      order_number: 1,
      cleaning_staff: [],
      cleaning_date: '2026-07-12',
    }
    const unassignedEarlyShort = {
      order_number: 2,
      cleaning_staff: null,
      cleaning_date: '2026-07-10',
      checkout_at: '2026-07-10T10:00:00Z',
      checkin_at: '2026-07-10T12:00:00Z',
    }
    const unassignedEarlyLong = {
      order_number: 3,
      cleaning_staff: [],
      cleaning_date: '2026-07-10',
      checkout_at: '2026-07-10T08:00:00Z',
      checkin_at: '2026-07-10T16:00:00Z',
    }

    const input = [unassignedLate, unassignedEarlyLong, unassignedEarlyShort]
    const sorted = [...input].sort(compareServiceOrderPriority)

    expect(sorted.map(o => o.order_number)).toEqual([2, 3, 1])
  })
})

