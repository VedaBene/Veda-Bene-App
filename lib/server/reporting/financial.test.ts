import { describe, expect, it } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import {
  getPayableDetailRows,
  getPayableStatementRows,
  getReceivableDetailRows,
  getReceivableStatementRows,
} from './financial'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'

const filters = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
}

function asSupabase(fake: FakeSupabase): SupabaseServerClient {
  return fake as unknown as SupabaseServerClient
}

describe('canonical financial reporting producers', () => {
  it('builds payable detail rows from property average hours and unique staff per order', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          worked_minutes: 90,
          cleaning_staff: [{ id: 'staff-1' }],
          consegna_staff_id: null,
          property: { name: 'Campo', avg_cleaning_hours: 4 },
        },
        {
          id: 'order-2',
          order_number: 2,
          status: 'done',
          completed_at: '2026-01-11',
          worked_minutes: null,
          cleaning_staff: [{ id: 'staff-2' }],
          consegna_staff_id: null,
          property: { name: 'Navona', avg_cleaning_hours: 2.25 },
        },
      ],
      profiles: [
        { id: 'staff-1', full_name: 'Ana', hourly_rate: 20, monthly_salary: null },
        { id: 'staff-2', full_name: 'Bruno', hourly_rate: 30, monthly_salary: 1200 },
      ],
    })

    await expect(getPayableDetailRows(asSupabase(fake), filters)).resolves.toEqual([
      {
        employee_id: 'staff-1',
        employee_name: 'Ana',
        order_id: 'order-1',
        order_number: 1,
        completed_at: '2026-01-10',
        property_name: 'Campo',
        hours: 4,
        hourly_rate: 20,
        monthly_salary: null,
        os_total: 80,
      },
      {
        employee_id: 'staff-2',
        employee_name: 'Bruno',
        order_id: 'order-2',
        order_number: 2,
        completed_at: '2026-01-11',
        property_name: 'Navona',
        hours: 2.25,
        hourly_rate: 30,
        monthly_salary: 1200,
        os_total: null,
      },
    ])
  })

  it('divides cleaning hours equally among multiple cleaning staff on the same service order', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          worked_minutes: 90,
          cleaning_staff: [{ id: 'staff-1' }, { id: 'staff-2' }],
          consegna_staff_id: null,
          property: { name: 'Campo', avg_cleaning_hours: 4 },
        },
      ],
      profiles: [
        { id: 'staff-1', full_name: 'Ana', hourly_rate: 20, monthly_salary: null },
        { id: 'staff-2', full_name: 'Bruno', hourly_rate: 30, monthly_salary: null },
      ],
    })

    // Esperado: 4 horas divididas por 2 = 2 horas para cada
    await expect(getPayableDetailRows(asSupabase(fake), filters)).resolves.toEqual([
      {
        employee_id: 'staff-1',
        employee_name: 'Ana',
        order_id: 'order-1',
        order_number: 1,
        completed_at: '2026-01-10',
        property_name: 'Campo',
        hours: 2,
        hourly_rate: 20,
        monthly_salary: null,
        os_total: 40,
      },
      {
        employee_id: 'staff-2',
        employee_name: 'Bruno',
        order_id: 'order-1',
        order_number: 1,
        completed_at: '2026-01-10',
        property_name: 'Campo',
        hours: 2,
        hourly_rate: 30,
        monthly_salary: null,
        os_total: 60,
      },
    ])
  })

  it('aggregates payable rows using property average hours without changing salary and hourly formulas', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          worked_minutes: 90,
          cleaning_staff: [{ id: 'staff-1' }],
          consegna_staff_id: null,
          property: { name: 'Campo', avg_cleaning_hours: 4 },
        },
        {
          id: 'order-2',
          order_number: 2,
          status: 'done',
          completed_at: '2026-01-11',
          worked_minutes: null,
          cleaning_staff: [{ id: 'staff-1' }],
          consegna_staff_id: 'staff-2',
          property: { name: 'Navona', avg_cleaning_hours: 2 },
        },
      ],
      profiles: [
        { id: 'staff-1', full_name: 'Ana', hourly_rate: 20, monthly_salary: null },
        { id: 'staff-2', full_name: 'Bruno', hourly_rate: 30, monthly_salary: 1200 },
      ],
    })

    await expect(getPayableStatementRows(asSupabase(fake), filters)).resolves.toEqual([
      {
        employee_id: 'staff-1',
        full_name: 'Ana',
        os_count: 2,
        total_hours: 6,
        hourly_rate: 20,
        monthly_salary: null,
        total_amount: 120,
      },
      {
        employee_id: 'staff-2',
        full_name: 'Bruno',
        os_count: 1,
        total_hours: 2,
        hourly_rate: 30,
        monthly_salary: 1200,
        total_amount: 1200,
      },
    ])
  })

  it('builds receivable detail rows from persisted total_price and filters by client', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          real_guests: 3,
          extra_services_price: 10,
          total_price: 123.456,
          property: {
            id: 'property-1',
            name: 'Campo',
            client_type: 'rental',
            agency: { id: 'agency-1', name: 'Agency' },
            owner: null,
          },
        },
        {
          id: 'order-2',
          order_number: 2,
          status: 'done',
          completed_at: '2026-01-11',
          real_guests: 2,
          extra_services_price: null,
          total_price: 50,
          property: {
            id: 'property-2',
            name: 'Private',
            client_type: 'particular',
            agency: null,
            owner: { id: 'owner-1', name: 'Owner' },
          },
        },
      ],
    })

    await expect(getReceivableDetailRows(asSupabase(fake), {
      ...filters,
      clientType: 'rental',
      clientId: 'agency-1',
    })).resolves.toEqual([
      {
        order_id: 'order-1',
        order_number: 1,
        completed_at: '2026-01-10',
        property_id: 'property-1',
        property_name: 'Campo',
        client_type: 'rental',
        client_name: 'Agency',
        real_guests: 3,
        extra_services_price: 10,
        total_price: 123.46,
      },
    ])
  })

  it('aggregates receivable rows by property', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          real_guests: 3,
          extra_services_price: 10,
          total_price: 100.111,
          property: {
            id: 'property-1',
            name: 'Campo',
            client_type: 'rental',
            agency: { id: 'agency-1', name: 'Agency' },
            owner: null,
          },
        },
        {
          id: 'order-2',
          order_number: 2,
          status: 'done',
          completed_at: '2026-01-11',
          real_guests: 4,
          extra_services_price: null,
          total_price: 50.222,
          property: {
            id: 'property-1',
            name: 'Campo',
            client_type: 'rental',
            agency: { id: 'agency-1', name: 'Agency' },
            owner: null,
          },
        },
      ],
    })

    await expect(getReceivableStatementRows(asSupabase(fake), filters)).resolves.toEqual([
      {
        property_id: 'property-1',
        property_name: 'Campo',
        client_type: 'rental',
        client_name: 'Agency',
        os_count: 2,
        total_value: 150.33,
      },
    ])
  })
})
