import type { PayableRow, ReceivableReport } from '@/lib/types/reporting'

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
    'Horas para Pagamento',
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

export function formatReceivableCSV(report: ReceivableReport): string {
  const header = row([
    'Sezione',
    'Data',
    'Numero OS',
    'Cliente',
    'Immobile',
    'PX',
    'M',
    'S',
    'DL',
    'WC',
    'BI',
    'CUL',
    'Prezzo base attuale',
    'Valore considerato',
    'Descrizione servizio extra',
    'Valore servizio extra',
    'Consegna',
    'Totale OS',
  ])

  const sections = [
    ['Standard', report.standard],
    ['Ripasso', report.ripasso],
    ['Out Long Stay', report.outLongStay],
  ] as const

  const rows = sections.flatMap(([sectionLabel, section]) =>
    section.rows.map(item => row([
      sectionLabel,
      item.cleaningDate,
      item.orderNumber,
      item.clientName,
      item.propertyName,
      item.occupancy.guests,
      item.occupancy.doubleBeds,
      item.occupancy.singleBeds,
      item.occupancy.sofaBeds,
      item.occupancy.bathrooms,
      item.occupancy.bidets,
      item.occupancy.cribs,
      item.currentBasePrice,
      item.consideredAmount,
      item.extraDescription,
      item.extraAmount,
      item.consegnaFee,
      item.totalPrice,
    ])),
  )

  return [header, ...rows].join('\n')
}
