import { describe, expect, it, vi } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'
import type { ReceivableStatementFilters } from '@/lib/server/validation/contracts'
import { getReceivableReport as getAuthorizedReceivableReport } from './receivable'

const sensitiveDataMocks = vi.hoisted(() => ({
  loadReceivableFinancialSource: vi.fn(),
}))

vi.mock('@/lib/server/data-access/sensitive-data', () => ({
  loadReceivableFinancialSource: sensitiveDataMocks.loadReceivableFinancialSource,
}))

const filters = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
}

function asSupabase(fake: FakeSupabase): SupabaseServerClient {
  return fake as unknown as SupabaseServerClient
}

async function getReceivableReport(supabase: SupabaseServerClient, input: ReceivableStatementFilters) {
  const fake = supabase as unknown as FakeSupabase
  sensitiveDataMocks.loadReceivableFinancialSource.mockResolvedValue(fake.rows('service_orders'))
  return getAuthorizedReceivableReport(input)
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 1,
    status: 'done',
    cleaning_date: '2026-05-10',
    pricing_mode: 'standard',
    real_guests: 4,
    double_beds: 2,
    single_beds: 0,
    sofa_beds: 1,
    bathrooms: 2,
    bidets: 1,
    cribs: 0,
    extra_services_description: 'Aggiunta asciugamani',
    extra_services_price: 15,
    consegna_fee: 10,
    total_price: 148,
    property: {
      id: 'property-1',
      name: 'Campo',
      client_type: 'rental',
      base_price: 110,
      agency: { id: '11111111-1111-4111-8111-111111111111', name: 'Rental' },
      owner: null,
    },
    ...overrides,
  }
}

describe('receivable report producer', () => {
  it('places each order once in its pricing-mode section and decomposes persisted totals', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        order(),
        order({
          id: 'order-2',
          order_number: 2,
          pricing_mode: 'ripasso',
          extra_services_description: null,
          extra_services_price: null,
          total_price: 70,
        }),
        order({
          id: 'order-3',
          order_number: 3,
          pricing_mode: 'out_long_stay',
          total_price: 225,
          extra_services_price: 25,
        }),
      ],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.standard.rows).toHaveLength(1)
    expect(report.ripasso.rows).toHaveLength(1)
    expect(report.outLongStay.rows).toHaveLength(1)
    expect(report.standard.rows[0]).toMatchObject({
      section: 'standard',
      financialStatus: 'complete',
      pendingReason: null,
      cleaningDate: '2026-05-10',
      currentBasePrice: 110,
      consideredAmount: 123,
      extraDescription: 'Aggiunta asciugamani',
      extraAmount: 15,
      consegnaFee: 10,
      totalPrice: 148,
    })
    expect(report.ripasso.rows[0]).toMatchObject({
      consideredAmount: 60,
      extraDescription: null,
      extraAmount: 0,
      totalPrice: 70,
    })
    expect(report.outLongStay.rows[0]).toMatchObject({
      consideredAmount: 190,
      extraAmount: 25,
      totalPrice: 225,
    })
    expect(report.grandTotal).toBe(443)
    expect(report).toMatchObject({
      orderCount: 3,
      completeOrderCount: 3,
      pendingCount: 0,
    })
  })

  it('sorts each section by Italian property name, cleaning date, and order number', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        order({ id: '3', order_number: 3, cleaning_date: '2026-05-12', property: { ...order().property as object, name: 'Èlite' } }),
        order({ id: '2', order_number: 2, cleaning_date: '2026-05-11', property: { ...order().property as object, name: 'Campo' } }),
        order({ id: '1', order_number: 1, cleaning_date: '2026-05-10', property: { ...order().property as object, name: 'Campo' } }),
        order({ id: '4', order_number: 4, cleaning_date: '2026-05-09', property: { ...order().property as object, name: 'Alberico' } }),
      ],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)
    expect(report.standard.rows.map(row => [row.propertyName, row.cleaningDate, row.orderNumber])).toEqual([
      ['Alberico', '2026-05-09', 4],
      ['Campo', '2026-05-10', 1],
      ['Campo', '2026-05-11', 2],
      ['Èlite', '2026-05-12', 3],
    ])
  })

  it('filters by client and uses current base price only as an informational value', async () => {
    const agencyId = '11111111-1111-4111-8111-111111111111'
    const fake = new FakeSupabase({
      service_orders: [
        order(),
        order({
          id: 'private-order',
          property: {
            id: 'private-property',
            name: 'Private',
            client_type: 'particular',
            base_price: null,
            agency: null,
            owner: { id: '22222222-2222-4222-8222-222222222222', name: 'Owner' },
          },
        }),
      ],
    })

    const report = await getReceivableReport(asSupabase(fake), {
      ...filters,
      clientType: 'rental',
      clientId: agencyId,
    })

    expect(report.standard.rows).toHaveLength(1)
    expect(report.standard.rows[0].clientName).toBe('Rental')
    expect(report.standard.sectionTotal).toBe(148)
  })

  it('shows a missing current base price as null without changing the historical total', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({
        property: {
          id: 'property-1',
          name: 'Campo',
          client_type: 'rental',
          base_price: null,
          agency: { id: '11111111-1111-4111-8111-111111111111', name: 'Rental' },
          owner: null,
        },
      })],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.standard.rows[0].currentBasePrice).toBeNull()
    expect(report.standard.rows[0].totalPrice).toBe(148)
    expect(report.standard.rows[0].financialStatus).toBe('complete')
    expect(report.pendingCount).toBe(0)
  })

  it('paginates beyond the local PostgREST limit without truncating rows', async () => {
    const orders = Array.from({ length: 1001 }, (_, index) => order({
      id: `order-${String(index).padStart(4, '0')}`,
      order_number: index + 1,
    }))
    const fake = new FakeSupabase({ service_orders: orders })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.standard.orderCount).toBe(1001)
    expect(report.standard.sectionTotal).toBe(148148)
  })

  it('keeps orders with missing totals visible as pending and excludes them from totals', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        order(),
        order({
          id: 'pending-order',
          order_number: 2,
          total_price: null,
          property: {
            id: 'property-without-price',
            name: 'Senza prezzo',
            client_type: 'rental',
            base_price: null,
            agency: { id: '11111111-1111-4111-8111-111111111111', name: 'Rental' },
            owner: null,
          },
        }),
      ],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)
    const pendingRow = report.standard.rows.find(row => row.orderId === 'pending-order')

    expect(pendingRow).toMatchObject({
      financialStatus: 'pending',
      pendingReason: 'missing_property_base_price',
      consideredAmount: null,
      totalPrice: null,
    })
    expect(report.standard).toMatchObject({
      orderCount: 2,
      completeOrderCount: 1,
      pendingCount: 1,
      sectionTotal: 148,
    })
    expect(report).toMatchObject({
      orderCount: 2,
      completeOrderCount: 1,
      pendingCount: 1,
      grandTotal: 148,
    })
  })

  it('distinguishes a missing order total from a missing property base price', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({ total_price: null })],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.standard.rows[0]).toMatchObject({
      financialStatus: 'pending',
      pendingReason: 'missing_total_price',
    })
  })

  it('does not attribute an Out Long Stay pending total to the property base price', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({
        pricing_mode: 'out_long_stay',
        total_price: null,
        property: {
          id: 'property-1',
          name: 'Campo',
          client_type: 'rental',
          base_price: null,
          agency: { id: '11111111-1111-4111-8111-111111111111', name: 'Rental' },
          owner: null,
        },
      })],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.outLongStay.rows[0]).toMatchObject({
      financialStatus: 'pending',
      pendingReason: 'missing_total_price',
    })
  })

  it('marks invalid financial composition as pending without hiding the order', async () => {
    const fake = new FakeSupabase({
      service_orders: [order({ total_price: 10, extra_services_price: 15, consegna_fee: 10 })],
    })

    const report = await getReceivableReport(asSupabase(fake), filters)

    expect(report.standard.rows[0]).toMatchObject({
      financialStatus: 'pending',
      pendingReason: 'invalid_financial_data',
      consideredAmount: null,
      totalPrice: 10,
    })
    expect(report.standard.sectionTotal).toBe(0)
    expect(report.pendingCount).toBe(1)
  })

  it('propagates a Supabase query failure instead of returning an empty report', async () => {
    const queryError = new Error('database unavailable')
    sensitiveDataMocks.loadReceivableFinancialSource.mockRejectedValueOnce(
      new Error('Não foi possível carregar o relatório a receber.', { cause: queryError }),
    )

    await expect(getAuthorizedReceivableReport(filters))
      .rejects.toThrow('Não foi possível carregar o relatório a receber.')
  })

  it('delegates the administrative query to the sensitive-data adapter', async () => {
    const fake = new FakeSupabase({ service_orders: [order()] })

    await getReceivableReport(asSupabase(fake), filters)

    const select = fake.selectCalls.find(call => call.table === 'service_orders')?.columns ?? ''
    expect(select).toBe('')
    expect(sensitiveDataMocks.loadReceivableFinancialSource).toHaveBeenCalledWith(filters)
  })
})
