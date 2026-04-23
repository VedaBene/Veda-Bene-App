import 'server-only'

import { createClient } from '@/utils/supabase/server'

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return ''
  let str = String(value)
  if (/^[\t\r ]*[=+\-@]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCSV).join(',')
}

export async function exportPayableCSV(startDate: string, endDate: string, employeeId?: string): Promise<string> {
  const supabase = await createClient()

  let query = supabase
    .from('service_orders')
    .select('cleaning_staff_id, consegna_staff_id, worked_minutes, property:properties(avg_cleaning_hours)')
    .eq('status', 'done')
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)

  if (employeeId) {
    query = query.or(`cleaning_staff_id.eq.${employeeId},consegna_staff_id.eq.${employeeId}`)
  }

  const { data: orders } = await query

  if (!orders || orders.length === 0) {
    return 'Funcionário,Total OS,Horas Trabalhadas,Valor/Hora,Salário Fixo,Total a Pagar\n'
  }

  const staffIds = new Set<string>()
  for (const o of orders) {
    if (o.cleaning_staff_id) staffIds.add(o.cleaning_staff_id)
    if (o.consegna_staff_id) staffIds.add(o.consegna_staff_id)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, hourly_rate, monthly_salary')
    .in('id', [...staffIds])

  const map = new Map<string, { full_name: string; os_count: number; total_hours: number; hourly_rate: number | null; monthly_salary: number | null }>()

  for (const p of profiles ?? []) {
    map.set(p.id, { full_name: p.full_name, os_count: 0, total_hours: 0, hourly_rate: p.hourly_rate ?? null, monthly_salary: p.monthly_salary ?? null })
  }

  for (const o of orders) {
    const wm = (o as { worked_minutes?: number | null }).worked_minutes
    const hours = wm != null
      ? wm / 60
      : (o.property as { avg_cleaning_hours?: number | null } | null)?.avg_cleaning_hours ?? 0
    if (o.cleaning_staff_id && map.has(o.cleaning_staff_id)) {
      const s = map.get(o.cleaning_staff_id)!; s.os_count++; s.total_hours += hours
    }
    if (o.consegna_staff_id && map.has(o.consegna_staff_id)) {
      const s = map.get(o.consegna_staff_id)!; s.os_count++; s.total_hours += hours
    }
  }

  const header = row(['Funcionário', 'Total OS', 'Horas Trabalhadas', 'Valor/Hora (€)', 'Salário Fixo (€)', 'Total a Pagar (€)'])
  const rows = [...map.values()].map(s => {
    const totalAmount = s.monthly_salary != null
      ? s.monthly_salary
      : s.hourly_rate != null ? Math.round(s.hourly_rate * s.total_hours * 100) / 100 : ''
    return row([s.full_name, s.os_count, Math.round(s.total_hours * 100) / 100, s.hourly_rate, s.monthly_salary, totalAmount])
  })

  return [header, ...rows].join('\n')
}

export async function exportReceivableCSV(
  startDate: string,
  endDate: string,
  clientType?: 'rental' | 'particular',
  clientId?: string,
): Promise<string> {
  const supabase = await createClient()

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

  const header = row(['Cliente', 'Tipo', 'Imóvel', 'Total OS', 'Total (€)'])

  if (!orders || orders.length === 0) {
    return header + '\n'
  }

  const map = new Map<string, { client_name: string; client_type: string; property_name: string; os_count: number; total_value: number }>()

  for (const o of orders) {
    const prop = o.property as { id: string; name: string; client_type: string; agency: { id: string; name: string } | null; owner: { id: string; name: string } | null } | null
    if (!prop) continue
    if (clientType && prop.client_type !== clientType) continue

    if (clientId) {
      const matchesAgency = prop.agency?.id === clientId
      const matchesOwner = prop.owner?.id === clientId
      if (!matchesAgency && !matchesOwner) continue
    }

    const resolvedClientName = prop.client_type === 'rental' ? (prop.agency?.name ?? '—') : (prop.owner?.name ?? '—')
    const typeLabel = prop.client_type === 'rental' ? 'Agência' : 'Particular'

    if (!map.has(prop.id)) {
      map.set(prop.id, { client_name: resolvedClientName, client_type: typeLabel, property_name: prop.name, os_count: 0, total_value: 0 })
    }
    const r = map.get(prop.id)!
    r.os_count++
    r.total_value += o.total_price ?? 0
  }

  const rows = [...map.values()].map(r =>
    row([r.client_name, r.client_type, r.property_name, r.os_count, Math.round(r.total_value * 100) / 100])
  )

  return [header, ...rows].join('\n')
}
