import { describe, expect, it } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import { getPropertyDetail, getPropertyList } from './properties'
import { getServiceOrderFormOptions } from './service-orders'
import type { SupabaseServerClient, Viewer } from './viewer'
import type { Role } from '@/lib/types/database'

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
  it('limits property list fields according to ADR 002 visibility', async () => {
    for (const [role, expected] of [
      ['admin', 'id, name, zone, address, client_type, base_price'],
      ['secretaria', 'id, name, zone, address, client_type'],
      ['limpeza', 'id, name, zone, address'],
      ['consegna', 'id, name, zone, address'],
      ['cliente', 'id, name, zone, address'],
    ] as const) {
      const fake = new FakeSupabase({ properties: [] })
      await getPropertyList(asSupabase(fake), viewer(role), { page: 1, pageSize: 10 })
      expect(firstSelectFor(fake, 'properties')).toBe(expected)
    }
  })

  it('keeps property detail financial columns admin-only', async () => {
    const admin = new FakeSupabase({ properties: [] })
    await getPropertyDetail(asSupabase(admin), viewer('admin'), 'property-1')
    expect(firstSelectFor(admin, 'properties')).toContain('base_price')
    expect(firstSelectFor(admin, 'properties')).toContain('extra_per_person')
    expect(firstSelectFor(admin, 'properties')).toContain('avg_cleaning_hours')

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
    const admin = new FakeSupabase({ properties: [], profiles: [] })
    await getServiceOrderFormOptions(asSupabase(admin), viewer('admin'))
    expect(firstSelectFor(admin, 'properties')).toContain('avg_cleaning_hours')
    expect(firstSelectFor(admin, 'properties')).toContain('base_price')

    const secretaria = new FakeSupabase({ properties: [], profiles: [] })
    await getServiceOrderFormOptions(asSupabase(secretaria), viewer('secretaria'))
    expect(firstSelectFor(secretaria, 'properties')).toContain('avg_cleaning_hours')
    expect(firstSelectFor(secretaria, 'properties')).not.toContain('base_price')

    const cliente = new FakeSupabase({ properties: [], profiles: [] })
    await getServiceOrderFormOptions(asSupabase(cliente), viewer('cliente'))
    expect(firstSelectFor(cliente, 'properties')).not.toContain('avg_cleaning_hours')
    expect(firstSelectFor(cliente, 'properties')).not.toContain('base_price')
  })
})
