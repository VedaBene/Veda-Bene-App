import { describe, expect, it, vi } from 'vitest'
import { FakeSupabase } from '@/test/fake-supabase'
import {
  getPayableDetailRows as getAuthorizedPayableDetailRows,
  getPayableStatementRows as getAuthorizedPayableStatementRows,
} from './financial'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'

const sensitiveDataMocks = vi.hoisted(() => ({
  loadPayableFinancialSource: vi.fn(),
}))

vi.mock('@/lib/server/data-access/sensitive-data', () => ({
  loadPayableFinancialSource: sensitiveDataMocks.loadPayableFinancialSource,
}))

const filters = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
}

function asSupabase(fake: FakeSupabase): SupabaseServerClient {
  return fake as unknown as SupabaseServerClient
}

function configurePayableSource(supabase: SupabaseServerClient) {
  const fake = supabase as unknown as FakeSupabase
  sensitiveDataMocks.loadPayableFinancialSource.mockResolvedValue({
    orders: fake.rows('service_orders'),
    profiles: fake.rows('profiles'),
  })
}

async function getPayableDetailRows(supabase: SupabaseServerClient, input: typeof filters) {
  configurePayableSource(supabase)
  return getAuthorizedPayableDetailRows(input)
}

async function getPayableStatementRows(supabase: SupabaseServerClient, input: typeof filters) {
  configurePayableSource(supabase)
  return getAuthorizedPayableStatementRows(input)
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

  it('counts only cleaning hours when the same employee also performs delivery', async () => {
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
          consegna_staff_id: 'staff-1',
          property: { name: 'Navona', avg_cleaning_hours: 2 },
        },
      ],
      profiles: [
        { id: 'staff-1', full_name: 'Ana', hourly_rate: 20, monthly_salary: null },
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
    ])
  })

  it('excludes delivery-only assignees from the payable statement', async () => {
    const fake = new FakeSupabase({
      service_orders: [
        {
          id: 'order-1',
          order_number: 1,
          status: 'done',
          completed_at: '2026-01-10',
          cleaning_staff: [],
          consegna_staff_id: 'staff-1',
          property: { name: 'Campo', avg_cleaning_hours: 4 },
        },
      ],
      profiles: [
        { id: 'staff-1', full_name: 'Ana', hourly_rate: 20, monthly_salary: null },
      ],
    })

    await expect(getPayableDetailRows(asSupabase(fake), filters)).resolves.toEqual([])
    await expect(getPayableStatementRows(asSupabase(fake), filters)).resolves.toEqual([])
  })

})
