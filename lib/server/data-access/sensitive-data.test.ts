import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import type { Role } from '@/lib/types/database'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentViewer: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('./viewer', () => ({ getCurrentViewer: mocks.getCurrentViewer }))

import {
  loadAuthorizedServiceOrderPropertyOptions,
  loadAverageHoursForVisibleServiceOrders,
  loadDashboardFinancialSource,
  loadEmployeeListForAdministration,
  loadPayableFinancialSource,
  loadPropertyListForAdministration,
  persistAuthorizedServiceOrderTotalPrice,
} from './sensitive-data'

function authorize(role: Role, scoped: FakeSupabase, privileged: FakeSupabase) {
  mocks.getCurrentViewer.mockResolvedValue({
    supabase: scoped,
    viewer: { userId: '00000000-0000-4000-8000-000000000001', role },
  })
  mocks.createClient.mockReturnValue(privileged)
}

describe('authorized sensitive-data adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder'
  })

  it('rejects a non-admin before creating a privileged client', async () => {
    authorize('secretaria', new FakeSupabase({}), new FakeSupabase({ profiles: [] }))

    await expect(loadEmployeeListForAdministration()).rejects.toThrow('Sem permissão')
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('returns the minimal administrative property-list DTO after authorization', async () => {
    const privileged = new FakeSupabase({
      properties: [{
        id: '00000000-0000-4000-8000-000000000010',
        name: 'Campo',
        zone: 'Colosseum',
        address: 'Via Roma',
        client_type: 'rental',
        base_price: 120,
        created_at: '2026-01-01',
      }],
    })
    authorize('admin', new FakeSupabase({}), privileged)

    const result = await loadPropertyListForAdministration({ page: 1, pageSize: 20 })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ name: 'Campo', base_price: 120 })
    expect(privileged.selectCalls[0].columns).not.toContain('*')
  })

  it('preserves secretaria operational hours without returning base price', async () => {
    const visibleProperty = {
      id: 'c3000000-0000-0000-0000-000000000020',
      name: 'Navona',
      min_guests: 2,
      max_guests: 4,
      double_beds: 1,
      single_beds: 0,
      sofa_beds: 0,
      armchair_beds: 0,
      bathrooms: 1,
      bidets: 1,
      cribs: 0,
    }
    const privilegedProperty = {
      ...visibleProperty,
      avg_cleaning_hours: 3,
      base_price: 150,
    }
    authorize(
      'secretaria',
      new FakeSupabase({ properties: [visibleProperty] }),
      new FakeSupabase({ properties: [privilegedProperty] }),
    )

    const result = await loadAuthorizedServiceOrderPropertyOptions()

    expect(result.rows[0]).toMatchObject({ avg_cleaning_hours: 3 })
    expect(result.rows[0]).not.toHaveProperty('base_price')
  })

  it('intersects operational property ids with the viewer RLS scope before privilege', async () => {
    const visibleId = '00000000-0000-4000-8000-000000000030'
    const hiddenId = '00000000-0000-4000-8000-000000000031'
    authorize(
      'limpeza',
      new FakeSupabase({ service_orders: [{ property_id: visibleId }] }),
      new FakeSupabase({
        properties: [
          { id: visibleId, avg_cleaning_hours: 2 },
          { id: hiddenId, avg_cleaning_hours: 9 },
        ],
      }),
    )

    const result = await loadAverageHoursForVisibleServiceOrders([visibleId, hiddenId])

    expect(result.get(visibleId)).toBe(2)
    expect(result.has(hiddenId)).toBe(false)
  })

  it('persists only total_price after confirming the operational row through RLS', async () => {
    const orderId = '00000000-0000-4000-8000-000000000040'
    const scoped = new FakeSupabase({ service_orders: [{ id: orderId }] })
    const privileged = new FakeSupabase({ service_orders: [{ id: orderId, total_price: 10 }] })
    authorize('limpeza', scoped, privileged)

    await persistAuthorizedServiceOrderTotalPrice(orderId, 125.5)

    expect(scoped.selectCalls).toEqual([
      { table: 'service_orders', columns: 'id', options: undefined },
    ])
    expect(privileged.updates).toEqual([{
      table: 'service_orders',
      values: { total_price: 125.5 },
      filters: [{ kind: 'eq', column: 'id', value: orderId }],
    }])
  })

  it('does not use the privileged write when the order is outside the viewer RLS scope', async () => {
    const orderId = '00000000-0000-4000-8000-000000000041'
    const privileged = new FakeSupabase({ service_orders: [{ id: orderId, total_price: 10 }] })
    authorize('limpeza', new FakeSupabase({ service_orders: [] }), privileged)

    await expect(persistAuthorizedServiceOrderTotalPrice(orderId, 125.5))
      .rejects.toThrow('O.L. non trovato o non autorizzato.')
    expect(privileged.updates).toEqual([])
  })

  it('queries payable financial source with exact Rome UTC half-open boundaries', async () => {
    const privileged = new FakeSupabase({
      service_orders: [
        {
          id: '00000000-0000-4000-8000-000000000050',
          order_number: 50,
          status: 'done',
          completed_at: '2026-07-31T22:30:00.000Z', // 00:30 CEST on 2026-08-01 (included)
          cleaning_staff: [{ id: '00000000-0000-4000-8000-000000000001' }],
          property: { name: 'Campo', avg_cleaning_hours: 3 },
        },
        {
          id: '00000000-0000-4000-8000-000000000051',
          order_number: 51,
          status: 'done',
          completed_at: '2026-08-31T21:45:00.000Z', // 23:45 CEST on 2026-08-31 (included)
          cleaning_staff: [{ id: '00000000-0000-4000-8000-000000000001' }],
          property: { name: 'Navona', avg_cleaning_hours: 2 },
        },
        {
          id: '00000000-0000-4000-8000-000000000052',
          order_number: 52,
          status: 'done',
          completed_at: '2026-08-31T22:00:00.000Z', // 00:00 CEST on 2026-09-01 (excluded by .lt)
          cleaning_staff: [{ id: '00000000-0000-4000-8000-000000000001' }],
          property: { name: 'Colosseo', avg_cleaning_hours: 4 },
        },
        {
          id: '00000000-0000-4000-8000-000000000053',
          order_number: 53,
          status: 'done',
          completed_at: '2026-07-31T21:59:59.000Z', // 23:59 CEST on 2026-07-31 (excluded by .gte)
          cleaning_staff: [{ id: '00000000-0000-4000-8000-000000000001' }],
          property: { name: 'Vaticano', avg_cleaning_hours: 5 },
        },
      ],
      profiles: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          full_name: 'Ana',
          hourly_rate: 15,
          monthly_salary: null,
        },
      ],
    })
    authorize('admin', new FakeSupabase({}), privileged)

    const result = await loadPayableFinancialSource(
      { startDate: '2026-08-01', endDate: '2026-08-31' },
      true,
    )

    expect(result.orders).toHaveLength(2)
    expect(result.orders.map(o => o.order_number)).toEqual([50, 51])
  })

  it('queries dashboard financial sources separating TIMESTAMPTZ UTC intervals from DATE boundaries', async () => {
    const privileged = new FakeSupabase({
      service_orders: [],
      profiles: [],
    })
    authorize('admin', new FakeSupabase({}), privileged)

    const result = await loadDashboardFinancialSource({
      monthStart: '2026-08-01',
      today: '2026-08-15',
      yearStart: '2026-01-01',
      threeMonthsAgoStart: '2026-06-01',
    })

    expect(result.properties.status).toBe('fulfilled')
    expect(result.hours.status).toBe('fulfilled')
    expect(result.revenue.status).toBe('fulfilled')
    expect(result.topMonth.status).toBe('fulfilled')
    expect(result.topYear.status).toBe('fulfilled')
    expect(result.recentOrders.status).toBe('fulfilled')
  })
})
