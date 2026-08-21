import { describe, expect, it, vi } from 'vitest'
import { saveServiceOrder } from './save-service-order'
import * as authz from '@/lib/server/authz'
import * as sensitiveData from '@/lib/server/data-access/sensitive-data'
import * as pricing from '@/lib/server/pricing'

describe('saveServiceOrder use case', () => {
  it('creates a service order atomically with calculated pricing', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'order-123', error: null })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })
    vi.spyOn(sensitiveData, 'loadAuthorizedPropertyPricingContext').mockResolvedValue({
      base_price: 100,
      extra_per_person: 20,
      min_guests: 2,
    })

    const result = await saveServiceOrder({
      property_id: 'prop-1',
      cleaning_staff_ids: ['staff-1', 'staff-2'],
      consegna_staff_id: 'consegna-1',
      cleaning_date: '2026-08-25',
      real_guests: 4,
      double_beds: 2,
      single_beds: 1,
      sofa_beds: 0,
      armchair_beds: 0,
      bathrooms: 2,
      bidets: 1,
      cribs: 0,
      cleaning_notes: 'Notes',
      extra_services_description: null,
      extra_services_price: 0,
      pricing_mode: 'standard',
    })

    expect(result).toEqual({ success: true, orderId: 'order-123' })
    expect(mockRpc).toHaveBeenCalledWith('save_service_order_atomic', expect.objectContaining({
      p_order_id: null,
      p_property_id: 'prop-1',
      p_cleaning_staff_ids: ['staff-1', 'staff-2'],
      p_consegna_staff_id: 'consegna-1',
      p_cleaning_date: '2026-08-25',
      p_real_guests: 4,
      p_total_price: 150, // base 100 + extra 20 * (4 - 2) + 10 consegna fee = 150
      p_pricing_mode: 'standard',
    }))
  })

  it('updates an existing service order atomically', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'order-123', error: null })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'secretaria-1',
      role: 'secretaria',
    })
    vi.spyOn(pricing, 'loadOrderPricingContext').mockResolvedValue({
      propertyId: 'prop-1',
      pricingMode: 'standard',
      realGuests: 3,
      extraServicesPrice: 15,
      workedMinutes: 120,
      property: {
        base_price: 100,
        extra_per_person: 20,
        min_guests: 2,
      },
    })

    const result = await saveServiceOrder({
      id: 'order-123',
      property_id: 'prop-1',
      cleaning_staff_ids: ['staff-3'],
      consegna_staff_id: null,
      cleaning_date: '2026-08-26',
      real_guests: 3,
      double_beds: 1,
      single_beds: 0,
      sofa_beds: 0,
      armchair_beds: 0,
      bathrooms: 1,
      bidets: 1,
      cribs: 0,
      pricing_mode: 'standard',
      extra_services_price: 15,
    })

    expect(result).toEqual({ success: true, orderId: 'order-123' })
    expect(mockRpc).toHaveBeenCalledWith('save_service_order_atomic', expect.objectContaining({
      p_order_id: 'order-123',
      p_property_id: 'prop-1',
      p_cleaning_staff_ids: ['staff-3'],
      p_total_price: 145, // 100 + 20*(3-2) + 15 + 10 = 145
    }))
  })

  it('returns failure when the atomic RPC returns an error', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Imóvel não encontrado.' },
    })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })
    vi.spyOn(sensitiveData, 'loadAuthorizedPropertyPricingContext').mockResolvedValue(null)

    const result = await saveServiceOrder({
      property_id: 'invalid-prop',
      cleaning_staff_ids: [],
      pricing_mode: 'standard',
      double_beds: 0,
      single_beds: 0,
      sofa_beds: 0,
      armchair_beds: 0,
      bathrooms: 0,
      bidets: 0,
      cribs: 0,
    })

    expect(result).toEqual({ success: false, error: 'Imóvel não encontrado.' })
  })
})
