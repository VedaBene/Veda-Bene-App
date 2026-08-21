import { describe, expect, it, vi } from 'vitest'
import { saveProperty } from './save-property'
import * as authz from '@/lib/server/authz'

describe('saveProperty use case', () => {
  it('creates a B2B property with new agency atomically', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'prop-100', error: null })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })

    const result = await saveProperty({
      name: 'Appartamento Navona',
      client_type: 'rental',
      zone: 'Piazza Navona',
      new_agency_name: 'Luxury Rentals Roma',
      new_agency_email: 'info@luxuryroma.it',
      phone: '+39 06 1234567',
      address: 'Via Navona 10',
      zip_code: '00186',
      sqm_interior: 85,
      min_guests: 2,
      max_guests: 4,
      double_beds: 2,
      bathrooms: 1,
      base_price: 120,
    })

    expect(result).toEqual({ success: true, propertyId: 'prop-100' })
    expect(mockRpc).toHaveBeenCalledWith('save_property_atomic', expect.objectContaining({
      p_property_id: null,
      p_name: 'Appartamento Navona',
      p_client_type: 'rental',
      p_zone: 'Piazza Navona',
      p_new_agency_name: 'Luxury Rentals Roma',
      p_new_agency_email: 'info@luxuryroma.it',
      p_agency_id: null,
      p_owner_id: null,
      p_double_beds: 2,
      p_base_price: 120,
    }))
  })

  it('creates a B2C property with new owner atomically', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'prop-200', error: null })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })

    const result = await saveProperty({
      name: 'Casa Trastevere',
      client_type: 'particular',
      zone: 'Trastevere Area',
      new_owner_name: 'Mario Rossi',
      new_owner_email: 'mario.rossi@email.com',
      double_beds: 1,
      single_beds: 1,
      bathrooms: 1,
    })

    expect(result).toEqual({ success: true, propertyId: 'prop-200' })
    expect(mockRpc).toHaveBeenCalledWith('save_property_atomic', expect.objectContaining({
      p_property_id: null,
      p_name: 'Casa Trastevere',
      p_client_type: 'particular',
      p_zone: 'Trastevere Area',
      p_new_owner_name: 'Mario Rossi',
      p_new_owner_email: 'mario.rossi@email.com',
      p_owner_id: null,
      p_agency_id: null,
      p_double_beds: 1,
      p_single_beds: 1,
    }))
  })

  it('updates an existing property with existing agency', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: '550e8400-e29b-41d4-a716-446655440000', error: null })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })

    const result = await saveProperty({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Appartamento Navona Renovated',
      client_type: 'rental',
      zone: 'Piazza Navona',
      agency_id: '650e8400-e29b-41d4-a716-446655440001',
      existing_agency_email: 'update@agency.it',
      double_beds: 2,
    })

    expect(result).toEqual({ success: true, propertyId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(mockRpc).toHaveBeenCalledWith('save_property_atomic', expect.objectContaining({
      p_property_id: '550e8400-e29b-41d4-a716-446655440000',
      p_agency_id: '650e8400-e29b-41d4-a716-446655440001',
      p_existing_agency_email: 'update@agency.it',
      p_client_type: 'rental',
    }))
  })

  it('rejects invalid email formats early in validation', async () => {
    const result = await saveProperty({
      name: 'Prop Invalid Email',
      client_type: 'rental',
      zone: 'Colosseum',
      new_agency_name: 'Agency Bad Email',
      new_agency_email: 'invalid-email-format',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/email/i)
    }
  })

  it('rejects invalid zones', async () => {
    const result = await saveProperty({
      name: 'Prop Invalid Zone',
      client_type: 'particular',
      zone: 'Invalid Zone City' as unknown as 'Saint Peter',
    })

    expect(result.success).toBe(false)
  })

  it('returns failure when the atomic RPC returns an error', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint' },
    })
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: { rpc: mockRpc } as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })

    const result = await saveProperty({
      name: 'Prop with missing agency',
      client_type: 'rental',
      zone: 'Colosseum',
      agency_id: '750e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toEqual({ success: false, error: 'Elemento correlato non trovato o non valido.' })
  })
})
