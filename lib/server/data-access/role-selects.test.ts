import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import { getPropertyDetail, getPropertyList } from './properties'
import { getServiceOrderFormOptions } from './service-orders'
import type { SupabaseServerClient, Viewer } from './viewer'
import type { Role } from '@/lib/types/database'

const sensitiveDataMocks = vi.hoisted(() => ({
  loadPropertyListForAdministration: vi.fn(),
  loadPropertyDetailForAdministration: vi.fn(),
  loadAuthorizedServiceOrderPropertyOptions: vi.fn(),
  loadAverageHoursForVisibleServiceOrders: vi.fn(),
  loadAuthorizedServiceOrderOperationalFinancialFields: vi.fn(),
}))

vi.mock('./sensitive-data', () => sensitiveDataMocks)

function asSupabase(fake: FakeSupabase): SupabaseServerClient {
  return fake as unknown as SupabaseServerClient
}

function viewer(role: Role): Viewer {
  return { userId: `${role}-user`, role }
}

function firstSelectFor(fake: FakeSupabase, table: string): string {
  return fake.selectCalls.find(call => call.table === table)?.columns ?? ''
}

describe('DAL role-aware selects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sensitiveDataMocks.loadPropertyListForAdministration.mockResolvedValue({ rows: [], count: 0 })
    sensitiveDataMocks.loadPropertyDetailForAdministration.mockResolvedValue(null)
    sensitiveDataMocks.loadAverageHoursForVisibleServiceOrders.mockResolvedValue(new Map())
  })

  it('limits property list fields according to ADR 002 visibility', async () => {
    for (const [role, expected] of [
      ['admin', ''],
      ['secretaria', 'id, name, zone, address, client_type'],
      ['limpeza', 'id, name, zone, address'],
      ['consegna', 'id, name, zone, address'],
      ['cliente', 'id, name, zone, address'],
    ] as const) {
      const fake = new FakeSupabase({ properties: [] })
      await getPropertyList(asSupabase(fake), viewer(role), { page: 1, pageSize: 10 })
      expect(firstSelectFor(fake, 'properties')).toBe(expected)
    }
    expect(sensitiveDataMocks.loadPropertyListForAdministration).toHaveBeenCalledOnce()
  })

  it('keeps property detail financial columns admin-only', async () => {
    const admin = new FakeSupabase({ properties: [] })
    await getPropertyDetail(asSupabase(admin), viewer('admin'), '00000000-0000-4000-8000-000000000001')
    expect(firstSelectFor(admin, 'properties')).toBe('')
    expect(sensitiveDataMocks.loadPropertyDetailForAdministration).toHaveBeenCalledOnce()

    const secretaria = new FakeSupabase({ properties: [] })
    await getPropertyDetail(asSupabase(secretaria), viewer('secretaria'), 'property-1')
    expect(firstSelectFor(secretaria, 'properties')).toContain('client_type')
    expect(firstSelectFor(secretaria, 'properties')).not.toContain('base_price')

    const cliente = new FakeSupabase({ properties: [] })
    await getPropertyDetail(asSupabase(cliente), viewer('cliente'), 'property-1')
    expect(firstSelectFor(cliente, 'properties')).not.toContain('client_type')
    expect(firstSelectFor(cliente, 'properties')).not.toContain('avg_cleaning_hours')
  })

  it('keeps service-order property option pricing fields off non-admin roles', async () => {
    sensitiveDataMocks.loadAuthorizedServiceOrderPropertyOptions.mockResolvedValueOnce({
      role: 'admin',
      rows: [{ id: 'p1', name: 'Admin', avg_cleaning_hours: 2, base_price: 100 }],
    })
    const admin = new FakeSupabase({ properties: [], profiles: [] })
    const adminOptions = await getServiceOrderFormOptions(asSupabase(admin), viewer('admin'))
    expect(adminOptions.properties[0]).toMatchObject({ avg_cleaning_hours: 2, base_price: 100 })

    sensitiveDataMocks.loadAuthorizedServiceOrderPropertyOptions.mockResolvedValueOnce({
      role: 'secretaria',
      rows: [{ id: 'p2', name: 'Secretaria', avg_cleaning_hours: 3 }],
    })
    const secretaria = new FakeSupabase({ properties: [], profiles: [] })
    const secretariaOptions = await getServiceOrderFormOptions(asSupabase(secretaria), viewer('secretaria'))
    expect(secretariaOptions.properties[0]).toMatchObject({ avg_cleaning_hours: 3 })
    expect(secretariaOptions.properties[0]).not.toHaveProperty('base_price')

    sensitiveDataMocks.loadAuthorizedServiceOrderPropertyOptions.mockResolvedValueOnce({
      role: 'cliente',
      rows: [{ id: 'p3', name: 'Cliente' }],
    })
    const cliente = new FakeSupabase({ properties: [], profiles: [] })
    const clienteOptions = await getServiceOrderFormOptions(asSupabase(cliente), viewer('cliente'))
    expect(clienteOptions.properties[0]).not.toHaveProperty('avg_cleaning_hours')
    expect(clienteOptions.properties[0]).not.toHaveProperty('base_price')
  })
})
