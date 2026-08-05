import type { PayableDetailRow, ReceivableReport } from '@/lib/types/reporting'

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

function formatPayableDate(value: string | null): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(date)
}

export function formatPayableCSV(data: PayableDetailRow[]): string {
  const header = row([
    'Dipendente',
    'Data O.L.',
    'Numero O.L.',
    'Immobile/i',
    'Ore da pagare (h)',
    'Tariffa oraria (€)',
    'Totale per O.L. (€)',
  ])

  const rows = data.map(item =>
    row([
      item.employee_name,
      formatPayableDate(item.completed_at),
      item.order_number,
      item.property_name,
      item.hours.toFixed(2),
      item.hourly_rate?.toFixed(2) ?? '-',
      item.os_total?.toFixed(2) ?? '-',
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
