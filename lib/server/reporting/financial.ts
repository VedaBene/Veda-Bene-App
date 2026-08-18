import 'server-only'

import { captureQueryError } from '@/lib/server/logger'
import { resolveOrderHours, resolveOrderPayableHours } from '@/lib/server/hours'
import type { DashboardData, MonthStat, TopProperty } from '@/lib/types/dashboard'
import type {
  ClientOption,
  EmployeeOption,
  PayableDetailRow,
  PayableRow,
} from '@/lib/types/reporting'
import type { PayableStatementFilters } from '@/lib/server/validation/contracts'
import type { SupabaseServerClient } from '@/lib/server/data-access/viewer'
import {
  loadDashboardFinancialSource,
  loadPayableFinancialSource,
  type StaffCompensationSource,
} from '@/lib/server/data-access/sensitive-data'

type StaffProfile = StaffCompensationSource

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
  filters: PayableStatementFilters,
): Promise<PayableRow[]> {
  const detailRows = await getPayableDetailRows(filters)
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
  filters: PayableStatementFilters,
): Promise<PayableDetailRow[]> {
  const { orders, profiles } = await loadPayableFinancialSource(filters, true)
  if (orders.length === 0) return []

  const profileById = new Map(profiles.map(profile => [profile.id, profile]))
  if (profileById.size === 0) return []

  const rows: PayableDetailRow[] = []

  for (const order of orders) {
    const hours = resolveOrderPayableHours(order.property)
    const uniqueStaffIds = new Set<string>()
    const cleaningStaff = order.cleaning_staff ?? []
    const cleaningStaffCount = cleaningStaff.length

    for (const cleaner of cleaningStaff) {
      uniqueStaffIds.add(cleaner.id)
    }

    if (filters.employeeId && !uniqueStaffIds.has(filters.employeeId)) {
      continue
    }

    for (const staffId of uniqueStaffIds) {
      if (filters.employeeId && staffId !== filters.employeeId) continue
      const profile = profileById.get(staffId)
      if (!profile) continue

      const staffHours = hours / Math.max(1, cleaningStaffCount)

      const roundedHours = roundMoney(staffHours)
      const osTotal =
        profile.monthly_salary != null
          ? null
          : profile.hourly_rate != null
            ? roundMoney(profile.hourly_rate * staffHours)
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

export async function getDashboardReportingData(): Promise<DashboardData> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)

  const source = await loadDashboardFinancialSource({ monthStart, today, yearStart, threeMonthsAgoStart })
  const propertiesRes = source.properties
  const hoursRes = source.hours
  const revenueRes = source.revenue
  const topMonthRes = source.topMonth
  const topYearRes = source.topYear
  const recentOrdersRes = source.recentOrders

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
    cleaning_staff: { id: string }[] | null
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

  const profilesData = unwrap<StaffProfile>(source.profiles, 'staff_profiles')
  const profilesMap = new Map(profilesData.map(profile => [profile.id, profile]))

  const staffCostByMonth: MonthStat[] = months.map(({ key, label }) => {
    const monthOrders = recentOrders.filter(order => datePrefix(order.completed_at) === key)
    let cost = 0

    for (const order of monthOrders) {
      const hours = resolveOrderHours(order, order.property)
      const cleaningStaff = order.cleaning_staff ?? []
      const cleaningStaffCount = cleaningStaff.length

      for (const cleaner of cleaningStaff) {
        const profile = profilesMap.get(cleaner.id)
        if (!profile) continue

        const assignedHours = hours / Math.max(1, cleaningStaffCount)
        if (profile.monthly_salary != null) {
          cost += profile.monthly_salary / 22
        } else if (profile.hourly_rate != null) {
          cost += profile.hourly_rate * assignedHours
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
