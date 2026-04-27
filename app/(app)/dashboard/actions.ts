'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { captureQueryError } from '@/lib/server/logger'
import type { Role } from '@/lib/types/database'

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

export type TopProperty = {
  property_id: string
  property_name: string
  os_count: number
}

export type MonthStat = {
  month: string  // 'YYYY-MM'
  label: string  // 'jan', 'fev', etc.
  value: number
}

export type DashboardData = {
  propertiesThisMonth: number
  hoursThisMonth: number
  revenueThisMonth: number
  topMonth: TopProperty[]
  topYear: TopProperty[]
  revenueByMonth: MonthStat[]
  staffCostByMonth: MonthStat[]
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
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

export async function fetchDashboardData(): Promise<{ data: DashboardData; role: Role }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role
  if (role !== 'admin') redirect('/service-orders')

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

  // Imóveis atendidos no mês
  const propertiesData = unwrap<{ property_id: string }>(propertiesRes, 'properties_this_month')
  const propertiesThisMonth = new Set(propertiesData.map(o => o.property_id)).size

  // Horas trabalhadas no mês
  const hoursData = unwrap<{ worked_minutes: number | null; property: { avg_cleaning_hours: number | null } | null }>(hoursRes, 'hours_this_month')
  const hoursThisMonth = Math.round(
    hoursData.reduce((sum, o) => {
      const wm = (o as { worked_minutes?: number | null }).worked_minutes
      const hours = wm != null
        ? wm / 60
        : ((o.property as { avg_cleaning_hours?: number | null } | null)?.avg_cleaning_hours ?? 0)
      return sum + hours
    }, 0) * 100
  ) / 100

  // Receita do mês
  const revenueData = unwrap<{ total_price: number | null }>(revenueRes, 'revenue_this_month')
  const revenueThisMonth = Math.round(
    revenueData.reduce((sum, o) => sum + (o.total_price ?? 0), 0) * 100
  ) / 100

  // Top imóveis
  const topMonthRaw = unwrap<{
    property_id: string | null
    property: { id: string; name: string | null } | null
  }>(topMonthRes, 'top_month')
  const topYearRaw = unwrap<{
    property_id: string | null
    property: { id: string; name: string | null } | null
  }>(topYearRes, 'top_year')

  const topMonth = getTopProperties(topMonthRaw)
  const topYear = getTopProperties(topYearRaw)

  // Agregação mensal (últimos 3 meses)
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

  const revenueByMonth: MonthStat[] = months.map(({ key, label }) => {
    const value = Math.round(
      recentOrders
        .filter(o => o.completed_at?.startsWith(key))
        .reduce((sum, o) => sum + (o.total_price ?? 0), 0) * 100
    ) / 100
    return { month: key, label, value }
  })

  // Custo com funcionários — buscar profiles para calcular
  const staffIds = new Set<string>()
  for (const o of recentOrders) {
    if (o.cleaning_staff_id) staffIds.add(o.cleaning_staff_id)
    if (o.consegna_staff_id) staffIds.add(o.consegna_staff_id)
  }

  const profilesMap = new Map<string, { hourly_rate: number | null; monthly_salary: number | null }>()
  if (staffIds.size > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, hourly_rate, monthly_salary')
      .in('id', [...staffIds])

    if (profilesError) {
      captureQueryError('dashboard', 'staff_profiles', profilesError)
    }

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, { hourly_rate: p.hourly_rate ?? null, monthly_salary: p.monthly_salary ?? null })
    }
  }

  const staffCostByMonth: MonthStat[] = months.map(({ key, label }) => {
    const monthOrders = recentOrders.filter(o => o.completed_at?.startsWith(key))
    let cost = 0
    for (const o of monthOrders) {
      const wm = (o as { worked_minutes?: number | null }).worked_minutes
      const hours = wm != null
        ? wm / 60
        : ((o.property as { avg_cleaning_hours?: number | null } | null)?.avg_cleaning_hours ?? 0)
      for (const staffId of [o.cleaning_staff_id, o.consegna_staff_id]) {
        if (!staffId) continue
        const p = profilesMap.get(staffId)
        if (!p) continue
        if (p.monthly_salary != null) {
          cost += p.monthly_salary / 22
        } else if (p.hourly_rate != null) {
          cost += p.hourly_rate * hours
        }
      }
    }
    return { month: key, label, value: Math.round(cost * 100) / 100 }
  })

  return {
    role,
    data: {
      propertiesThisMonth,
      hoursThisMonth,
      revenueThisMonth,
      topMonth,
      topYear,
      revenueByMonth,
      staffCostByMonth,
    },
  }
}
