import { describe, expect, it, vi } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import { buildServiceOrdersPdfHtml } from '@/components/service-orders/ServiceOrderActiveExport'
import type { Role } from '@/lib/types/database'
import type { OperationalServiceOrderVisibility } from '@/lib/service-order-visibility'
import type { SupabaseServerClient, Viewer } from './viewer'
import { loadAuthorizedServiceOrderPropertyOptions } from './sensitive-data'
import { getServiceOrderDetail, getServiceOrderFormOptions, getServiceOrderList } from './service-orders'

vi.mock('./sensitive-data', () => ({
  loadAverageHoursForVisibleServiceOrders: vi.fn(async (ids: string[]) =>
    new Map(ids.map(id => [id, 2])),
  ),
  loadAuthorizedServiceOrderPropertyOptions: vi.fn(),
  loadAuthorizedServiceOrderOperationalFinancialFields: vi.fn(async () => null),
}))

const VISIBILITY: OperationalServiceOrderVisibility = {
  today: '2026-08-07',
  maxVisibleDate: '2026-08-07',
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
    cleaning_date: VISIBILITY.today,
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
    'caps active orders at today for %s while preserving overdue orders',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [
          order({ id: 'overdue', cleaning_date: '2026-08-06', order_number: 1 }),
          order({ id: 'today', cleaning_date: VISIBILITY.today, order_number: 2 }),
          order({ id: 'tomorrow', cleaning_date: '2026-08-08', order_number: 3 }),
          order({ id: 'undated', cleaning_date: null, order_number: 4 }),
        ],
      })

      const result = await getServiceOrderList(asSupabase(fake), viewer(role), FILTERS, VISIBILITY)

      expect(result.active.map(item => item.id)).toEqual(['today', 'overdue'])
    },
  )

  it('does not apply the operational date cap to administrative roles', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        order({ id: 'future', cleaning_date: '2026-08-09' }),
      ],
    })

    const result = await getServiceOrderList(asSupabase(fake), viewer('admin'), FILTERS, VISIBILITY)

    expect(result.active.map(item => item.id)).toEqual(['future'])
  })

  it.each(['limpeza', 'consegna'] as const)(
    'caps completed history at today for %s when date filters are active',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [
          order({ id: 'done-overdue', cleaning_date: '2026-08-06', status: 'done', order_number: 1 }),
          order({ id: 'done-today', cleaning_date: VISIBILITY.today, status: 'done', order_number: 2 }),
          order({ id: 'done-tomorrow', cleaning_date: '2026-08-08', status: 'done', order_number: 3 }),
        ],
      })

      const result = await getServiceOrderList(
        asSupabase(fake),
        viewer(role),
        { ...FILTERS, startDate: '2026-08-01' },
        VISIBILITY,
      )

      expect(result.done.map(item => item.id)).toEqual(['done-today', 'done-overdue'])
      expect(result.doneForExport.map(item => item.id)).toEqual(['done-today', 'done-overdue'])
    },
  )

  it.each(['limpeza', 'consegna'] as const)(
    'returns no rows when a crafted start date begins after today for %s',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [order({ id: 'today', cleaning_date: VISIBILITY.today })],
      })

      const result = await getServiceOrderList(
        asSupabase(fake),
        viewer(role),
        { ...FILTERS, startDate: '2026-08-08' },
        VISIBILITY,
      )

      expect(result.active).toEqual([])
    },
  )

  it.each(['limpeza', 'consegna'] as const)(
    'blocks direct future detail reads in the application layer for %s',
    async role => {
      const fake = new FakeSupabase({
        service_orders: [order({ id: 'tomorrow', cleaning_date: '2026-08-08' })],
        service_order_cleaning_staff: [{ service_order_id: 'tomorrow', profile_id: 'limpeza-user' }],
      })

      const result = await getServiceOrderDetail(asSupabase(fake), viewer(role), 'tomorrow', VISIBILITY)

      expect(result).toBeNull()
    },
  )

  it('keeps future detail reads unchanged for admin', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({ id: 'future', cleaning_date: '2026-08-09' })],
      service_order_cleaning_staff: [],
    })

    const result = await getServiceOrderDetail(asSupabase(fake), viewer('admin'), 'future', VISIBILITY)

    expect(result?.id).toBe('future')
  })

  it('filters active and done orders by checkinDate in Rome timezone and retrieves past completed orders', async () => {
    // 2026-08-21 Rome timezone: CEST (UTC+2) -> [2026-08-20T22:00:00.000Z, 2026-08-21T22:00:00.000Z)
    const fake = new FakeSupabase({
      service_orders: [
        // Completed earlier (cleaning on 2026-08-15) with check-in on 2026-08-21 15:00 Rome (13:00 UTC)
        order({
          id: 'done-earlier',
          cleaning_date: '2026-08-15',
          status: 'done',
          checkin_at: '2026-08-21T13:00:00Z',
          completed_at: '2026-08-15T12:00:00Z',
          order_number: 10,
        }),
        // In progress with check-in on 2026-08-21 11:00 Rome (09:00 UTC)
        order({
          id: 'active-today-checkin',
          cleaning_date: '2026-08-21',
          status: 'in_progress',
          checkin_at: '2026-08-21T09:00:00Z',
          order_number: 11,
        }),
        // Done but check-in is on different date (2026-08-25)
        order({
          id: 'done-other-checkin',
          cleaning_date: '2026-08-21',
          status: 'done',
          checkin_at: '2026-08-25T13:00:00Z',
          order_number: 12,
        }),
      ],
    })

    const result = await getServiceOrderList(
      asSupabase(fake),
      viewer('cliente'),
      { ...FILTERS, checkinDate: '2026-08-21' },
      VISIBILITY,
    )

    expect(result.active.map(item => item.id)).toEqual(['active-today-checkin'])
    expect(result.done.map(item => item.id)).toEqual(['done-earlier'])
    expect(result.doneForExport.map(item => item.id)).toEqual(['done-earlier'])
  })
})

describe('service-order list query failures', () => {
  it.each([
    [0, 'as ordens abertas'],
    [1, 'as ordens concluídas'],
    [2, 'as ordens para o PDF'],
  ])('rejects a failed list query %i instead of returning an empty list', async (selectIndex, message) => {
    const fake = new FakeSupabase({ service_orders: [] })
    const failure = new Error('Falha simulada de consulta')
    fake.selectErrors.set(selectIndex, failure)

    await expect(getServiceOrderList(asSupabase(fake), viewer('admin'), FILTERS, VISIBILITY))
      .rejects.toMatchObject({ message: `Falha ao carregar ${message}`, cause: failure })
  })

  it('rejects a failed property search lookup', async () => {
    const fake = new FakeSupabase({ properties: [], service_orders: [] })
    fake.selectErrors.set(0, new Error('Falha simulada de consulta'))

    await expect(getServiceOrderList(
      asSupabase(fake),
      viewer('admin'),
      { ...FILTERS, q: 'Casa' },
      VISIBILITY,
    )).rejects.toThrow('Falha ao carregar os imóveis correspondentes')
  })

  it('keeps a successful query with no matching assignments as an empty result', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({ assignment_filter: [{ profile_id: 'andy-user' }] })],
    })

    const result = await getServiceOrderList(
      asSupabase(fake),
      viewer('admin'),
      { ...FILTERS, cleaningStaffId: 'joe-user' },
      VISIBILITY,
    )

    expect(result.active).toEqual([])
    expect(result.done).toEqual([])
    expect(result.doneForExport).toEqual([])
    expect(result.doneTotalCount).toBe(0)
  })

  it('rejects a failed staff option query instead of hiding the filter choices', async () => {
    vi.mocked(loadAuthorizedServiceOrderPropertyOptions).mockResolvedValue({ role: 'admin', rows: [] })
    const fake = new FakeSupabase({ profiles: [] })
    fake.selectErrors.set(0, new Error('Falha simulada de consulta'))

    await expect(getServiceOrderFormOptions(asSupabase(fake), viewer('admin')))
      .rejects.toThrow('Falha ao carregar os funcionários')
  })
})

describe('service-order cleaning staff filter', () => {
  it('filters all three lists by assignment while preserving the full team and done pagination', async () => {
    const joe = { id: 'joe-user', full_name: 'Joe' }
    const andy = { id: 'andy-user', full_name: 'Andy' }
    const fake = new FakeSupabase({
      service_orders: [
        order({
          id: 'active-shared',
          order_number: 1001,
          cleaning_staff: [joe, andy],
          assignment_filter: [{ profile_id: joe.id }, { profile_id: andy.id }],
        }),
        order({
          id: 'active-andy',
          order_number: 1002,
          cleaning_staff: [andy],
          assignment_filter: [{ profile_id: andy.id }],
        }),
        order({
          id: 'done-joe-1',
          order_number: 1003,
          status: 'done',
          cleaning_staff: [joe],
          assignment_filter: [{ profile_id: joe.id }],
        }),
        order({
          id: 'done-joe-2',
          order_number: 1004,
          status: 'done',
          cleaning_staff: [joe],
          assignment_filter: [{ profile_id: joe.id }],
        }),
      ],
    })

    const result = await getServiceOrderList(
      asSupabase(fake),
      viewer('admin'),
      { ...FILTERS, cleaningStaffId: joe.id, donePageSize: 1 },
      VISIBILITY,
    )

    expect(result.active.map(item => item.id)).toEqual(['active-shared'])
    expect(result.active[0].cleaning_staff_ids).toEqual(['andy-user', 'joe-user'])
    expect(result.done.map(item => item.id)).toEqual(['done-joe-1'])
    expect(result.doneForExport.map(item => item.id)).toEqual(['done-joe-1', 'done-joe-2'])
    expect(result.doneTotalCount).toBe(2)
    expect(result.doneTotalPages).toBe(2)
    expect(fake.selectCalls).toHaveLength(3)
    expect(fake.selectCalls.every(call => call.table === 'service_orders')).toBe(true)
    expect(fake.selectCalls.every(call =>
      call.columns.includes('cleaning_staff:profiles!service_order_cleaning_staff(id, full_name)') &&
      call.columns.includes('assignment_filter:service_order_cleaning_staff!inner(profile_id)'),
    )).toBe(true)

    const openPdf = buildServiceOrdersPdfHtml(result.active, VISIBILITY.today, 'open')
    const donePdf = buildServiceOrdersPdfHtml(result.doneForExport, VISIBILITY.today, 'done')
    expect(openPdf).toContain('#1001')
    expect(openPdf).toContain('Andy, Joe')
    expect(openPdf).not.toContain('#1002')
    expect(donePdf).toContain('Completati: 2')
    expect(donePdf).toContain('#1003')
    expect(donePdf).toContain('#1004')
  })
})
