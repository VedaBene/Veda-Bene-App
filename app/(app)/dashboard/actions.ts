'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/types/database'

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

    supabase.rpc('get_top_properties', {
      start_date: monthStart,
      end_date: today,
      limit_count: 5,
    }),

    supabase.rpc('get_top_properties', {
      start_date: yearStart,
      end_date: today,
      limit_count: 5,
    }),

    supabase
      .from('service_orders')
      .select('completed_at, total_price, cleaning_staff_id, consegna_staff_id, worked_minutes, property:properties(avg_cleaning_hours)')
      .eq('status', 'done')
      .gte('completed_at', threeMonthsAgoStart)
      .lte('completed_at', today),
  ])

  // Imóveis atendidos no mês
  const propertiesData = propertiesRes.status === 'fulfilled' ? propertiesRes.value.data ?? [] : []
  const propertiesThisMonth = new Set(propertiesData.map(o => o.property_id)).size

  // Horas trabalhadas no mês
  const hoursData = hoursRes.status === 'fulfilled' ? hoursRes.value.data ?? [] : []
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
  const revenueData = revenueRes.status === 'fulfilled' ? revenueRes.value.data ?? [] : []
  const revenueThisMonth = Math.round(
    revenueData.reduce((sum, o) => sum + (o.total_price ?? 0), 0) * 100
  ) / 100

  // Top imóveis
  const topMonthRaw = topMonthRes.status === 'fulfilled' ? topMonthRes.value.data ?? [] : []
  const topYearRaw = topYearRes.status === 'fulfilled' ? topYearRes.value.data ?? [] : []

  const topMonth: TopProperty[] = topMonthRaw.map((r: { property_id: string; property_name: string; os_count: number }) => ({
    property_id: r.property_id,
    property_name: r.property_name,
    os_count: Number(r.os_count),
  }))

  const topYear: TopProperty[] = topYearRaw.map((r: { property_id: string; property_name: string; os_count: number }) => ({
    property_id: r.property_id,
    property_name: r.property_name,
    os_count: Number(r.os_count),
  }))

  // Agregação mensal (últimos 3 meses)
  const recentOrders = recentOrdersRes.status === 'fulfilled' ? recentOrdersRes.value.data ?? [] : []

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
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, hourly_rate, monthly_salary')
      .in('id', [...staffIds])

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
