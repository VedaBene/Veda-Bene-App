import 'server-only'

import { captureQueryError } from '@/lib/server/logger'
import { resolveOrderHours, resolveOrderPayableHours } from '@/lib/server/hours'
import type { DashboardData, MonthStat, TopProperty } from '@/lib/types/dashboard'
import type {
  ClientOption,
  EmployeeOption,
  PayableDetailRow,
  PayableRow,
  ReceivableDetailRow,
  ReceivableRow,
} from '@/lib/types/reporting'
import type { PayableStatementFilters, ReceivableStatementFilters } from '@/lib/server/validation/contracts'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'

type PayableOrder = {
  id: string
  order_number: number
  completed_at: string | null
  worked_minutes: number | null
  cleaning_staff_id: string | null
  consegna_staff_id: string | null
  property: { name?: string | null; avg_cleaning_hours: number | null } | null
}

type ReceivableOrder = {
  id: string
  order_number: number
  completed_at: string | null
  real_guests: number | null
  extra_services_price: number | null
  total_price: number | null
  property: {
    id: string
    name: string
    client_type: 'rental' | 'particular'
    agency: { id: string; name: string } | null
    owner: { id: string; name: string } | null
  } | null
}

type StaffProfile = {
  id: string
  full_name: string
  hourly_rate: number | null
  monthly_salary: number | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function datePrefix(date: string | null): string {
  return date?.slice(0, 7) ?? ''
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
}

function unwrap<T>(
  res: PromiseSettledResult<unknown>,
  query: string,
): T[] {
  if (res.status === 'rejected') {
    captureQueryError('dashboard', query, res.reason)
    return []
  }
  const value = res.value as { data: T[] | null; error: unknown } | null
  if (!value) return []
  if (value.error) {
    captureQueryError('dashboard', query, value.error)
    return []
  }
  return value.data ?? []
}

function clientName(property: NonNullable<ReceivableOrder['property']>): string {
  return property.client_type === 'rental'
    ? (property.agency?.name ?? '—')
    : (property.owner?.name ?? '—')
}

function matchesReceivableFilters(
  property: NonNullable<ReceivableOrder['property']>,
  filters: ReceivableStatementFilters,
): boolean {
  if (filters.clientType && filters.clientType !== 'all' && property.client_type !== filters.clientType) {
    return false
  }

  if (!filters.clientId) return true

  return property.agency?.id === filters.clientId || property.owner?.id === filters.clientId
}

async function fetchReceivableOrders(
  supabase: SupabaseServerClient,
  filters: ReceivableStatementFilters,
  includeDetail: boolean,
): Promise<ReceivableOrder[]> {
  let query = supabase
    .from('service_orders')
    .select(`
      id, order_number, completed_at, real_guests, extra_services_price, total_price,
      property:properties(
        id, name, client_type,
        agency:agencies(id, name),
        owner:owners(id, name)
      )
    `)
    .eq('status', 'done')
    .gte('completed_at', filters.startDate)
    .lte('completed_at', filters.endDate)

  if (includeDetail) {
    query = query.order('completed_at', { ascending: true })
  }

  const { data } = await query
  return (data ?? []) as unknown as ReceivableOrder[]
}

async function fetchPayableOrders(
  supabase: SupabaseServerClient,
  filters: PayableStatementFilters,
  includePropertyName: boolean,
): Promise<PayableOrder[]> {
  const propertySelect = includePropertyName
    ? 'property:properties(name, avg_cleaning_hours)'
    : 'property:properties(avg_cleaning_hours)'

  let query = supabase
    .from('service_orders')
    .select(`
      id, order_number, completed_at, worked_minutes,
      cleaning_staff_id, consegna_staff_id,
      ${propertySelect}
    `)
    .eq('status', 'done')
    .gte('completed_at', filters.startDate)
    .lte('completed_at', filters.endDate)

  if (includePropertyName) {
    query = query.order('completed_at', { ascending: true })
  }

  if (filters.employeeId) {
    query = query.or(`cleaning_staff_id.eq.${filters.employeeId},consegna_staff_id.eq.${filters.employeeId}`)
  }

  const { data } = await query
  return (data ?? []) as unknown as PayableOrder[]
}

async function fetchStaffProfiles(
  supabase: SupabaseServerClient,
  staffIds: Iterable<string>,
  logScope?: string,
): Promise<Map<string, StaffProfile>> {
  const ids = [...new Set(staffIds)]
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, hourly_rate, monthly_salary')
    .in('id', ids)

  if (error && logScope) {
    captureQueryError(logScope, 'staff_profiles', error)
  }

  return new Map((data ?? []).map(profile => [profile.id, profile]))
}

function payableStaffIds(orders: Pick<PayableOrder, 'cleaning_staff_id' | 'consegna_staff_id'>[]): string[] {
  const staffIds = new Set<string>()
  for (const order of orders) {
    if (order.cleaning_staff_id) staffIds.add(order.cleaning_staff_id)
    if (order.consegna_staff_id) staffIds.add(order.consegna_staff_id)
  }
  return [...staffIds]
}

export async function getReportingEmployees(supabase: SupabaseServerClient): Promise<EmployeeOption[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['limpeza', 'consegna'])
    .order('full_name')

  return data ?? []
}

export async function getReportingAgencies(supabase: SupabaseServerClient): Promise<ClientOption[]> {
  const { data } = await supabase
    .from('agencies')
    .select('id, name')
    .order('name')

  return data ?? []
}

export async function getReportingOwners(supabase: SupabaseServerClient): Promise<ClientOption[]> {
  const { data } = await supabase
    .from('owners')
    .select('id, name')
    .order('name')

  return data ?? []
}

export async function getPayableStatementRows(
  supabase: SupabaseServerClient,
  filters: PayableStatementFilters,
): Promise<PayableRow[]> {
  const detailRows = await getPayableDetailRows(supabase, filters)
  const map = new Map<string, PayableRow>()

  for (const detail of detailRows) {
    let row = map.get(detail.employee_id)
    if (!row) {
      row = {
        employee_id: detail.employee_id,
        full_name: detail.employee_name,
        os_count: 0,
        total_hours: 0,
        hourly_rate: detail.hourly_rate,
        monthly_salary: detail.monthly_salary,
        total_amount: null,
      }
      map.set(detail.employee_id, row)
    }

    row.os_count += 1
    row.total_hours += detail.hours
  }

  return [...map.values()].map(row => ({
    ...row,
    total_hours: roundMoney(row.total_hours),
    total_amount:
      row.monthly_salary != null
        ? row.monthly_salary
        : row.hourly_rate != null
          ? roundMoney(row.hourly_rate * row.total_hours)
          : null,
  }))
}

export async function getPayableDetailRows(
  supabase: SupabaseServerClient,
  filters: PayableStatementFilters,
): Promise<PayableDetailRow[]> {
  const orders = await fetchPayableOrders(supabase, filters, true)
  if (orders.length === 0) return []

  const profileById = await fetchStaffProfiles(supabase, payableStaffIds(orders))
  if (profileById.size === 0) return []

  const rows: PayableDetailRow[] = []

  for (const order of orders) {
    const hours = resolveOrderPayableHours(order.property)
    const uniqueStaffIds = new Set<string>()
    if (order.cleaning_staff_id) uniqueStaffIds.add(order.cleaning_staff_id)
    if (order.consegna_staff_id) uniqueStaffIds.add(order.consegna_staff_id)

    for (const staffId of uniqueStaffIds) {
      if (filters.employeeId && staffId !== filters.employeeId) continue
      const profile = profileById.get(staffId)
      if (!profile) continue

      const roundedHours = roundMoney(hours)
      const osTotal =
        profile.monthly_salary != null
          ? null
          : profile.hourly_rate != null
            ? roundMoney(profile.hourly_rate * hours)
            : null

      rows.push({
        employee_id: profile.id,
        employee_name: profile.full_name,
        order_id: order.id,
        order_number: order.order_number,
        completed_at: order.completed_at,
        property_name: order.property?.name ?? '—',
        hours: roundedHours,
        hourly_rate: profile.hourly_rate ?? null,
        monthly_salary: profile.monthly_salary ?? null,
        os_total: osTotal,
      })
    }
  }

  rows.sort((a, b) => {
    if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name)
    return (a.completed_at ?? '').localeCompare(b.completed_at ?? '')
  })

  return rows
}

export async function getReceivableStatementRows(
  supabase: SupabaseServerClient,
  filters: ReceivableStatementFilters,
): Promise<ReceivableRow[]> {
  const detailRows = await getReceivableDetailRows(supabase, filters)
  const map = new Map<string, ReceivableRow>()

  for (const detail of detailRows) {
    let row = map.get(detail.property_id)
    if (!row) {
      row = {
        property_id: detail.property_id,
        property_name: detail.property_name,
        client_type: detail.client_type,
        client_name: detail.client_name,
        os_count: 0,
        total_value: 0,
      }
      map.set(detail.property_id, row)
    }

    row.os_count += 1
    row.total_value += detail.total_price
  }

  return [...map.values()].map(row => ({
    ...row,
    total_value: roundMoney(row.total_value),
  }))
}

export async function getReceivableDetailRows(
  supabase: SupabaseServerClient,
  filters: ReceivableStatementFilters,
): Promise<(ReceivableDetailRow & { property_id: string })[]> {
  const orders = await fetchReceivableOrders(supabase, filters, true)
  const rows: (ReceivableDetailRow & { property_id: string })[] = []

  for (const order of orders) {
    const property = order.property
    if (!property || !matchesReceivableFilters(property, filters)) continue

    rows.push({
      order_id: order.id,
      order_number: order.order_number,
      completed_at: order.completed_at,
      property_id: property.id,
      property_name: property.name,
      client_type: property.client_type,
      client_name: clientName(property),
      real_guests: order.real_guests,
      extra_services_price: order.extra_services_price,
      total_price: roundMoney(order.total_price ?? 0),
    })
  }

  return rows
}

function getTopProperties(
  orders: {
    property_id: string | null
    property: { id: string; name: string | null } | null
  }[],
): TopProperty[] {
  const counts = new Map<string, TopProperty>()

  for (const order of orders) {
    if (!order.property_id) continue
    const current = counts.get(order.property_id)
    if (current) {
      current.os_count += 1
      continue
    }

    counts.set(order.property_id, {
      property_id: order.property_id,
      property_name: order.property?.name ?? 'Imóvel sem nome',
      os_count: 1,
    })
  }

  return [...counts.values()]
    .sort((a, b) => b.os_count - a.os_count)
    .slice(0, 5)
}

export async function getDashboardReportingData(supabase: SupabaseServerClient): Promise<DashboardData> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)

  const [
    propertiesRes,
    hoursRes,
    revenueRes,
    topMonthRes,
    topYearRes,
    recentOrdersRes,
  ] = await Promise.allSettled([
    supabase
      .from('service_orders')
      .select('property_id')
      .eq('status', 'done')
      .gte('completed_at', monthStart)
      .lte('completed_at', today),

    supabase
      .from('service_orders')
      .select('worked_minutes, property:properties(avg_cleaning_hours)')
      .eq('status', 'done')
      .gte('completed_at', monthStart)
      .lte('completed_at', today),

    supabase
      .from('service_orders')
      .select('total_price')
      .eq('status', 'done')
      .gte('completed_at', monthStart)
      .lte('completed_at', today),

    supabase
      .from('service_orders')
      .select('property_id, property:properties(id, name)')
      .eq('status', 'done')
      .gte('cleaning_date', monthStart)
      .lte('cleaning_date', today),

    supabase
      .from('service_orders')
      .select('property_id, property:properties(id, name)')
      .eq('status', 'done')
      .gte('cleaning_date', yearStart)
      .lte('cleaning_date', today),

    supabase
      .from('service_orders')
      .select('completed_at, total_price, cleaning_staff_id, consegna_staff_id, worked_minutes, property:properties(avg_cleaning_hours)')
      .eq('status', 'done')
      .gte('completed_at', threeMonthsAgoStart)
      .lte('completed_at', today),
  ])

  const propertiesData = unwrap<{ property_id: string }>(propertiesRes, 'properties_this_month')
  const propertiesThisMonth = new Set(propertiesData.map(o => o.property_id)).size

  const hoursData = unwrap<{
    worked_minutes: number | null
    property: { avg_cleaning_hours: number | null } | null
  }>(hoursRes, 'hours_this_month')
  const hoursThisMonth = roundMoney(
    hoursData.reduce((sum, order) => sum + resolveOrderHours(order, order.property), 0),
  )

  const revenueData = unwrap<{ total_price: number | null }>(revenueRes, 'revenue_this_month')
  const revenueThisMonth = roundMoney(
    revenueData.reduce((sum, order) => sum + (order.total_price ?? 0), 0),
  )

  const topMonthRaw = unwrap<{
    property_id: string | null
    property: { id: string; name: string | null } | null
  }>(topMonthRes, 'top_month')
  const topYearRaw = unwrap<{
    property_id: string | null
    property: { id: string; name: string | null } | null
  }>(topYearRes, 'top_year')

  const recentOrders = unwrap<{
    completed_at: string | null
    total_price: number | null
    cleaning_staff_id: string | null
    consegna_staff_id: string | null
    worked_minutes: number | null
    property: { avg_cleaning_hours: number | null } | null
  }>(recentOrdersRes, 'recent_orders')

  const months = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1)
    return { key: monthKey(d), label: monthLabel(d) }
  })

  const revenueByMonth: MonthStat[] = months.map(({ key, label }) => ({
    month: key,
    label,
    value: roundMoney(
      recentOrders
        .filter(order => datePrefix(order.completed_at) === key)
        .reduce((sum, order) => sum + (order.total_price ?? 0), 0),
    ),
  }))

  const profilesMap = await fetchStaffProfiles(supabase, payableStaffIds(recentOrders), 'dashboard')

  const staffCostByMonth: MonthStat[] = months.map(({ key, label }) => {
    const monthOrders = recentOrders.filter(order => datePrefix(order.completed_at) === key)
    let cost = 0

    for (const order of monthOrders) {
      const hours = resolveOrderHours(order, order.property)
      for (const staffId of [order.cleaning_staff_id, order.consegna_staff_id]) {
        if (!staffId) continue
        const profile = profilesMap.get(staffId)
        if (!profile) continue

        if (profile.monthly_salary != null) {
          cost += profile.monthly_salary / 22
        } else if (profile.hourly_rate != null) {
          cost += profile.hourly_rate * hours
        }
      }
    }

    return { month: key, label, value: roundMoney(cost) }
  })

  return {
    propertiesThisMonth,
    hoursThisMonth,
    revenueThisMonth,
    topMonth: getTopProperties(topMonthRaw),
    topYear: getTopProperties(topYearRaw),
    revenueByMonth,
    staffCostByMonth,
  }
}
