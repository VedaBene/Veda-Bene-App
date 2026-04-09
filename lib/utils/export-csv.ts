import { createClient } from '@/utils/supabase/server'

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCSV).join(',')
}

export async function exportPayableCSV(startDate: string, endDate: string): Promise<string> {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('service_orders')
    .select('cleaning_staff_id, consegna_staff_id, property:properties(avg_cleaning_hours)')
    .eq('status', 'done')
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)

  if (!orders || orders.length === 0) {
    return 'Funcionário,Total OS,Total Horas,Valor/Hora,Salário Fixo,Total a Pagar\n'
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
    const hours = (o.property as { avg_cleaning_hours?: number | null } | null)?.avg_cleaning_hours ?? 0
    if (o.cleaning_staff_id && map.has(o.cleaning_staff_id)) {
      const s = map.get(o.cleaning_staff_id)!; s.os_count++; s.total_hours += hours
    }
    if (o.consegna_staff_id && map.has(o.consegna_staff_id)) {
      const s = map.get(o.consegna_staff_id)!; s.os_count++; s.total_hours += hours
    }
  }

  const header = row(['Funcionário', 'Total OS', 'Total Horas', 'Valor/Hora (€)', 'Salário Fixo (€)', 'Total a Pagar (€)'])
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
): Promise<string> {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('service_orders')
    .select(`
      total_price,
      property:properties(
        id, name, client_type,
        agency:agencies(name),
        owner:owners(name)
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
    const prop = o.property as { id: string; name: string; client_type: string; agency: { name: string } | null; owner: { name: string } | null } | null
    if (!prop) continue
    if (clientType && prop.client_type !== clientType) continue

    const clientName = prop.client_type === 'rental' ? (prop.agency?.name ?? '—') : (prop.owner?.name ?? '—')
    const typeLabel = prop.client_type === 'rental' ? 'B2B' : 'B2C'

    if (!map.has(prop.id)) {
      map.set(prop.id, { client_name: clientName, client_type: typeLabel, property_name: prop.name, os_count: 0, total_value: 0 })
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
