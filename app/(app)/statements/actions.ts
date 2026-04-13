'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/types/database'

export type PayableRow = {
  employee_id: string
  full_name: string
  os_count: number
  total_hours: number
  hourly_rate: number | null
  monthly_salary: number | null
  total_amount: number | null
}

export type ReceivableRow = {
  property_id: string
  property_name: string
  client_type: 'rental' | 'particular'
  client_name: string
  os_count: number
  total_value: number
}

export type EmployeeOption = {
  id: string
  full_name: string
}

export type ClientOption = {
  id: string
  name: string
}

async function getAuthorizedClient(minRole: 'secretaria' | 'admin' = 'secretaria') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed: Role[] = minRole === 'admin' ? ['admin'] : ['admin', 'secretaria']
  if (!profile || !allowed.includes(profile.role as Role)) {
    throw new Error('Sem permissão')
  }

  return { supabase, role: profile.role as Role }
}

export async function fetchEmployees(): Promise<EmployeeOption[]> {
  const { supabase } = await getAuthorizedClient('admin')
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['limpeza', 'consegna'])
    .order('full_name')
  return data ?? []
}

export async function fetchPayableData(
  startDate: string,
  endDate: string,
  employeeId?: string,
): Promise<PayableRow[]> {
  const { supabase } = await getAuthorizedClient('admin')

  // Buscar OSs finalizadas no período com horas do imóvel
  let query = supabase
    .from('service_orders')
    .select('cleaning_staff_id, consegna_staff_id, property:properties(avg_cleaning_hours)')
    .eq('status', 'done')
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)

  if (employeeId) {
    query = query.or(`cleaning_staff_id.eq.${employeeId},consegna_staff_id.eq.${employeeId}`)
  }

  const { data: orders } = await query

  if (!orders || orders.length === 0) return []

  // Coletar IDs únicos de funcionários
  const staffIds = new Set<string>()
  for (const o of orders) {
    if (o.cleaning_staff_id) staffIds.add(o.cleaning_staff_id)
    if (o.consegna_staff_id) staffIds.add(o.consegna_staff_id)
  }

  if (staffIds.size === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, hourly_rate, monthly_salary')
    .in('id', [...staffIds])

  if (!profiles) return []

  // Agregar por funcionário
  const map = new Map<string, PayableRow>()
  for (const p of profiles) {
    map.set(p.id, {
      employee_id: p.id,
      full_name: p.full_name,
      os_count: 0,
      total_hours: 0,
      hourly_rate: p.hourly_rate ?? null,
      monthly_salary: p.monthly_salary ?? null,
      total_amount: null,
    })
  }

  for (const o of orders) {
    const hours = (o.property as { avg_cleaning_hours?: number | null } | null)?.avg_cleaning_hours ?? 0
    if (o.cleaning_staff_id && map.has(o.cleaning_staff_id)) {
      const row = map.get(o.cleaning_staff_id)!
      row.os_count++
      row.total_hours += hours
    }
    if (o.consegna_staff_id && map.has(o.consegna_staff_id)) {
      const row = map.get(o.consegna_staff_id)!
      row.os_count++
      row.total_hours += hours
    }
  }

  return [...map.values()].map(row => ({
    ...row,
    total_hours: Math.round(row.total_hours * 100) / 100,
    total_amount:
      row.monthly_salary != null
        ? row.monthly_salary
        : row.hourly_rate != null
          ? Math.round(row.hourly_rate * row.total_hours * 100) / 100
          : null,
  }))
}

export async function fetchAgencies(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient('secretaria')
  const { data } = await supabase
    .from('agencies')
    .select('id, name')
    .order('name')
  return data ?? []
}

export async function fetchOwners(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient('secretaria')
  const { data } = await supabase
    .from('owners')
    .select('id, name')
    .order('name')
  return data ?? []
}

export async function fetchReceivableData(
  startDate: string,
  endDate: string,
  clientType?: 'rental' | 'particular' | 'all',
  clientId?: string,
): Promise<ReceivableRow[]> {
  const { supabase } = await getAuthorizedClient('secretaria')

  const { data: orders } = await supabase
    .from('service_orders')
    .select(`
      total_price,
      property:properties(
        id, name, client_type,
        agency:agencies(id, name),
        owner:owners(id, name)
      )
    `)
    .eq('status', 'done')
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)

  if (!orders) return []

  // Agregar por imóvel
  const map = new Map<string, ReceivableRow>()

  for (const o of orders) {
    const prop = o.property as {
      id: string
      name: string
      client_type: 'rental' | 'particular'
      agency: { id: string; name: string } | null
      owner: { id: string; name: string } | null
    } | null

    if (!prop) continue

    // Filtro de tipo de cliente
    if (clientType && clientType !== 'all' && prop.client_type !== clientType) continue

    // Filtro por cliente específico (agência ou proprietário)
    if (clientId) {
      const matchesAgency = prop.agency?.id === clientId
      const matchesOwner = prop.owner?.id === clientId
      if (!matchesAgency && !matchesOwner) continue
    }

    const resolvedName =
      prop.client_type === 'rental'
        ? (prop.agency?.name ?? '—')
        : (prop.owner?.name ?? '—')

    if (!map.has(prop.id)) {
      map.set(prop.id, {
        property_id: prop.id,
        property_name: prop.name,
        client_type: prop.client_type,
        client_name: resolvedName,
        os_count: 0,
        total_value: 0,
      })
    }

    const row = map.get(prop.id)!
    row.os_count++
    row.total_value += o.total_price ?? 0
  }

  return [...map.values()].map(r => ({
    ...r,
    total_value: Math.round(r.total_value * 100) / 100,
  }))
}
