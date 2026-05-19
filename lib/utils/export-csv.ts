import type { PayableRow, ReceivableRow } from '@/lib/types/reporting'

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

export function formatPayableCSV(data: PayableRow[]): string {
  const header = row([
    'Funcionário',
    'Total OS',
    'Horas Trabalhadas',
    'Valor/Hora (€)',
    'Salário Fixo (€)',
    'Total a Pagar (€)',
  ])

  const rows = data.map(item =>
    row([
      item.full_name,
      item.os_count,
      item.total_hours,
      item.hourly_rate,
      item.monthly_salary,
      item.total_amount,
    ]),
  )

  return [header, ...rows].join('\n')
}

export function formatReceivableCSV(data: ReceivableRow[]): string {
  const header = row(['Cliente', 'Tipo', 'Imóvel', 'Total OS', 'Total (€)'])
  const rows = data.map(item =>
    row([
      item.client_name,
      item.client_type === 'rental' ? 'Agência' : 'Particular',
      item.property_name,
      item.os_count,
      item.total_value,
    ]),
  )

  return [header, ...rows].join('\n')
}
