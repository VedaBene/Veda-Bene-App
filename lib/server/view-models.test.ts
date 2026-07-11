import { describe, expect, it } from 'vitest'
import {
  toEmployeeFormData,
  toPropertyFormData,
  toPropertyListItem,
  toServiceOrderFormData,
  toServiceOrderListItem,
} from './view-models'
import type { PropertyFormData, ServiceOrderFormData, ServiceOrderListItem } from '@/lib/types/view-models'

const property: PropertyFormData = {
  id: 'property-1',
  name: 'Campo',
  client_type: 'rental',
  agency_id: 'agency-1',
  owner_id: null,
  zone: 'Other areas',
  phone: '123',
  address: 'Via Roma',
  zip_code: '00100',
  sqm_interior: 40,
  sqm_exterior: null,
  sqm_total: 40,
  min_guests: 2,
  max_guests: 4,
  double_beds: 1,
  single_beds: 2,
  sofa_beds: 0,
  armchair_beds: 0,
  bathrooms: 1,
  bidets: 1,
  cribs: 0,
  bedrooms: 2,
  base_price: 100,
  extra_per_person: 15,
  avg_cleaning_hours: 3,
  notes: 'internal',
}

const order: ServiceOrderFormData = {
  id: 'order-1',
  property_id: 'property-1',
  cleaning_staff_id: 'cleaner-1',
  cleaning_staff_ids: ['cleaner-1'],
  consegna_staff_id: 'consegna-1',
  cleaning_date: '2026-01-10',

  checkout_at: '2026-01-10T09:00:00Z',
  checkin_at: '2026-01-10T13:00:00Z',
  status: 'done',
  real_guests: 3,
  double_beds: 1,
  single_beds: 2,
  sofa_beds: 0,
  armchair_beds: 0,
  bathrooms: 1,
  bidets: 1,
  cribs: 0,
  order_number: 7,
  is_urgent: false,
  started_at: '2026-01-10T10:00:00Z',
  completed_at: '2026-01-10T12:00:00Z',
  worked_minutes: 120,
  pricing_mode: 'standard',
  cleaning_notes: 'admin note',
  extra_services_description: 'windows',
  extra_services_price: 25,
  completion_notes: 'done well',
}

describe('view-model role visibility', () => {
  it('keeps employee pay fields admin-only', () => {
    const employee = {
      id: 'employee-1',
      full_name: 'Ana',
      email: 'ana@example.com',
      phone: null,
      birth_date: null,
      nationality: null,
      address: null,
      role: 'limpeza' as const,
      hourly_rate: 12,
      monthly_salary: 1000,
      overtime_rate: 18,
    }

    expect(toEmployeeFormData(employee, 'admin')).toMatchObject({
      hourly_rate: 12,
      monthly_salary: 1000,
      overtime_rate: 18,
    })
    expect(toEmployeeFormData(employee, 'secretaria')).not.toHaveProperty('hourly_rate')
  })

  it('keeps property financial fields admin-only and client ownership fields off worker DTOs', () => {
    expect(toPropertyListItem(property, 'admin')).toMatchObject({ client_type: 'rental', base_price: 100 })
    expect(toPropertyListItem(property, 'secretaria')).toEqual({
      id: 'property-1',
      name: 'Campo',
      zone: 'Other areas',
      address: 'Via Roma',
      client_type: 'rental',
    })
    expect(toPropertyListItem(property, 'limpeza')).toEqual({
      id: 'property-1',
      name: 'Campo',
      zone: 'Other areas',
      address: 'Via Roma',
    })

    expect(toPropertyFormData(property, 'admin')).toMatchObject({
      base_price: 100,
      extra_per_person: 15,
      avg_cleaning_hours: 3,
      phone: '123',
    })
    expect(toPropertyFormData(property, 'secretaria')).not.toHaveProperty('base_price')
    expect(toPropertyFormData(property, 'cliente')).not.toHaveProperty('client_type')
  })

  it('hides responsible staff names from cliente service-order list DTOs', () => {
    const listOrder: ServiceOrderListItem = {
      ...order,
      property: { id: 'property-1', name: 'Campo', avg_cleaning_hours: 3 },
      cleaning_staff: [{ id: 'cleaner-1', full_name: 'Ana' }],
      consegna_staff: { id: 'consegna-1', full_name: 'Bruno' },
    }

    expect(toServiceOrderListItem(listOrder, 'admin')).toMatchObject({
      cleaning_staff: [{ full_name: 'Ana' }],
      consegna_staff: { full_name: 'Bruno' },
      completed_at: '2026-01-10T12:00:00Z',
      worked_minutes: 120,
    })
    expect(toServiceOrderListItem(listOrder, 'cliente')).toMatchObject({
      cleaning_staff: [],
      consegna_staff: null,
    })
  })

  it('keeps service-order financial and internal notes limited to admin or secretaria', () => {
    expect(toServiceOrderFormData(order, 'admin')).toMatchObject({
      cleaning_notes: 'admin note',
      extra_services_description: 'windows',
      extra_services_price: 25,
      completion_notes: 'done well',
    })
    expect(toServiceOrderFormData(order, 'secretaria')).toMatchObject({
      extra_services_price: 25,
      completion_notes: 'done well',
    })

    const workerDto = toServiceOrderFormData(order, 'limpeza', 'cleaner-1')
    expect(workerDto).toMatchObject({ completion_notes: 'done well' })
    expect(workerDto).not.toHaveProperty('extra_services_price')
    expect(toServiceOrderFormData(order, 'cliente')).not.toHaveProperty('completion_notes')
  })
})
