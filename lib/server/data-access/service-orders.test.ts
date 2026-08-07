import { describe, expect, it } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import type { Role } from '@/lib/types/database'
import type { OperationalServiceOrderWindow } from '@/lib/service-order-visibility'
import type { SupabaseServerClient, Viewer } from './viewer'
import { getServiceOrderDetail, getServiceOrderList } from './service-orders'

const WINDOW: OperationalServiceOrderWindow = {
  today: '2026-08-07',
  tomorrow: '2026-08-08',
}

function viewer(role: Role): Viewer {
  return { userId: `${role}-user`, role }
}

function asSupabase(fake: FakeSupabase): SupabaseServerClient {
  return fake as unknown as SupabaseServerClient
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-today',
    property_id: 'property-1',
    cleaning_staff_id: null,
    consegna_staff_id: 'consegna-user',
    cleaning_date: WINDOW.today,
    checkout_at: null,
    checkin_at: null,
    status: 'open',
    real_guests: 2,
    double_beds: 1,
    single_beds: 0,
    sofa_beds: 0,
    armchair_beds: 0,
    bathrooms: 1,
    bidets: 1,
    cribs: 0,
    order_number: 1,
    is_urgent: false,
    started_at: null,
    completed_at: null,
    completion_notes: null,
    worked_minutes: null,
    pricing_mode: 'standard',
    consegna_fee: 10,
    cleaning_notes: null,
    property: { id: 'property-1', name: 'Casa Roma', avg_cleaning_hours: 2 },
    cleaning_staff: [],
    consegna_staff: { id: 'consegna-user', full_name: 'Marco' },
    ...overrides,
  }
}

const FILTERS = {
  donePage: 1,
  donePageSize: 20,
  q: undefined,
  propertyId: undefined,
  cleaningStaffId: undefined,
  consegnaStaffId: undefined,
  startDate: undefined,
  endDate: undefined,
}

describe('service-order operational visibility in the DAL', () => {
  it.each(['limpeza', 'consegna'] as const)(
    'caps active orders at tomorrow for %s while preserving overdue orders',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [
          order({ id: 'overdue', cleaning_date: '2026-08-06', order_number: 1 }),
          order({ id: 'tomorrow', cleaning_date: WINDOW.tomorrow, order_number: 2 }),
          order({ id: 'future', cleaning_date: '2026-08-09', order_number: 3 }),
          order({ id: 'undated', cleaning_date: null, order_number: 4 }),
        ],
      })

      const result = await getServiceOrderList(asSupabase(fake), viewer(role), FILTERS, WINDOW)

      expect(result.active.map(item => item.id)).toEqual(['tomorrow', 'overdue'])
    },
  )

  it('does not apply the operational date cap to administrative roles', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        order({ id: 'future', cleaning_date: '2026-08-09' }),
      ],
    })

    const result = await getServiceOrderList(asSupabase(fake), viewer('admin'), FILTERS, WINDOW)

    expect(result.active.map(item => item.id)).toEqual(['future'])
  })

  it.each(['limpeza', 'consegna'] as const)(
    'blocks direct future detail reads in the application layer for %s',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [order({ id: 'future', cleaning_date: '2026-08-09' })],
        service_order_cleaning_staff: [{ service_order_id: 'future', profile_id: 'limpeza-user' }],
      })

      const result = await getServiceOrderDetail(asSupabase(fake), viewer(role), 'future', WINDOW)

      expect(result).toBeNull()
    },
  )

  it('keeps future detail reads unchanged for admin', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({ id: 'future', cleaning_date: '2026-08-09' })],
      service_order_cleaning_staff: [],
    })

    const result = await getServiceOrderDetail(asSupabase(fake), viewer('admin'), 'future', WINDOW)

    expect(result?.id).toBe('future')
  })
})
