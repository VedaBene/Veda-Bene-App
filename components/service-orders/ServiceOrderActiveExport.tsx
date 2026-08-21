'use client'

import { FileDown } from 'lucide-react'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import {
  formatDate,
  formatDateTime,
  getCompactRomeDateTimeParts,
} from './display'
import { formatWorkedTime } from './LiveTimer'
import { compareServiceOrderPriority } from './ordering'

const OCCUPANCY_FIELDS: { key: keyof ServiceOrderListItem; label: string }[] = [
  { key: 'real_guests', label: 'PX' },
  { key: 'double_beds', label: 'M' },
  { key: 'single_beds', label: 'S' },
  { key: 'sofa_beds', label: 'DL' },
  { key: 'bathrooms', label: 'WC' },
  { key: 'bidets', label: 'BID' },
  { key: 'cribs', label: 'Culle' },
]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STATUS_TITLES: Record<'open' | 'in_progress' | 'done', string> = {
  open: 'Aperti',
  in_progress: 'In corso',
  done: 'Completati',
}

type PdfStatus = keyof typeof STATUS_TITLES

function getCleaningStaffNames(order: Pick<ServiceOrderListItem, 'cleaning_staff'>): string {
  return (order.cleaning_staff || [])
    .map(({ full_name }) => full_name.trim())
    .filter(Boolean)
    .join(', ')
}

function getConsegnaStaffName(order: Pick<ServiceOrderListItem, 'consegna_staff'>): string {
  return order.consegna_staff?.full_name.trim() ?? ''
}

function renderScheduleCells(
  order: Pick<ServiceOrderListItem, 'checkin_at' | 'checkout_at' | 'is_urgent' | 'status'>,
): string {
  const checkin = getCompactRomeDateTimeParts(order.checkin_at)
  const checkout = getCompactRomeDateTimeParts(order.checkout_at)
  const hasBothDates = checkin !== null && checkout !== null
  const sameDay = hasBothDates && checkin.calendarDayKey === checkout.calendarDayKey
  const differentDay = hasBothDates && !sameDay
  const showUrgency = order.is_urgent && order.status !== 'done'

  const timeClasses = ['time-part']
  if (sameDay) timeClasses.push('same-day-time')
  if (showUrgency) timeClasses.push('urgent-time')
  const timeClassName = timeClasses.join(' ')

  const checkinHtml = checkin
    ? `<span class="date-part${differentDay ? ' different-day-checkin-date' : ''}">${checkin.calendarDate}</span> <span class="${timeClassName}">${checkin.time}</span>`
    : '—'
  const checkoutHtml = checkout
    ? `<span class="${timeClassName}">${checkout.time}</span> <span class="date-part">${checkout.calendarDate}</span>`
    : '—'

  return `
      <td class="datetime-cell">${checkinHtml}</td>
      <td class="datetime-cell">${checkoutHtml}</td>`
}

export function buildServiceOrdersPdfHtml(
  orders: ServiceOrderListItem[],
  date: string,
  status: PdfStatus,
  dateLabelOverride?: string,
  isCliente: boolean = false,
): string {
  const sortedOrders = status !== 'done' ? [...orders].sort(compareServiceOrderPriority) : orders
  const showConsegnaStaff = !isCliente && sortedOrders.some((order) => getConsegnaStaffName(order) !== '')
  const showCleaningStaff = !isCliente && sortedOrders.some((order) => getCleaningStaffNames(order) !== '')
  const showWorkedTime = !isCliente && status === 'done' && sortedOrders.some(o => o.worked_minutes != null)

  let dateLabel = 'Tutte le date'
  if (dateLabelOverride) {
    dateLabel = dateLabelOverride
  } else if (date) {
    dateLabel = formatDate(date)
  } else if (status === 'done') {
    const todayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Rome' }).format(new Date())
    dateLabel = formatDate(todayStr) + ' (Oggi)'
  }

  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })

  const openCount = orders.filter((o) => o.status === 'open').length
  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length
  const doneCount = orders.filter((o) => o.status === 'done').length

  let statusSummaryHtml = ''
  if (status !== 'done') {
    const badges: string[] = []
    if (inProgressCount > 0) {
      badges.push(`<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: bold; margin-right: 8px; font-size: 11px;">In corso: ${inProgressCount}</span>`)
    }
    if (openCount > 0) {
      badges.push(`<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #fef3c7; color: #b45309; font-weight: bold; margin-right: 8px; font-size: 11px;">Aperti: ${openCount}</span>`)
    }
    if (badges.length > 0) {
      statusSummaryHtml = `<div class="status-summary">${badges.join('')}</div>`
    }
  } else if (status === 'done') {
    statusSummaryHtml = `<div class="status-summary">
      <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #dcfce7; color: #15803d; font-weight: bold; font-size: 11px;">Completati: ${doneCount}</span>
    </div>`
  }

  const totals: Record<string, number> = {}
  for (const { key } of OCCUPANCY_FIELDS) {
    totals[key as string] = sortedOrders.reduce((sum, o) => sum + ((o[key] as number) ?? 0), 0)
  }
  const activeTotalFields = OCCUPANCY_FIELDS.filter(({ key }) => totals[key as string] > 0)

  const rows = sortedOrders.map((o) => `
    <tr>
      <td>#${o.order_number}</td>
      <td class="property-cell">${escapeHtml(o.property?.name ?? '—')}</td>
      ${renderScheduleCells(o)}
      ${status === 'done' ? `<td class="completion-cell">
        <span><strong>Conclusa:</strong> ${formatDateTime(o.completed_at)}</span>
        ${showWorkedTime && o.worked_minutes != null ? `<span><strong>Tempo:</strong> ${formatWorkedTime(o.worked_minutes)}</span>` : ''}
      </td>` : ''}
      ${showCleaningStaff ? `<td class="staff-cell">${escapeHtml(getCleaningStaffNames(o)) || '—'}</td>` : ''}
      ${showConsegnaStaff ? `<td class="staff-cell">${escapeHtml(getConsegnaStaffName(o)) || '—'}</td>` : ''}
      ${OCCUPANCY_FIELDS.map(({ key }) => {
        const val = (o[key] as number) ?? 0
        return `<td class="${val > 0 ? 'highlight' : 'dim'}">${val > 0 ? val : '—'}</td>`
      }).join('')}
      <td class="notes-cell">${o.cleaning_notes ? escapeHtml(o.cleaning_notes) : '—'}</td>
    </tr>
  `).join('')

  const totalHeaders = activeTotalFields
    .map(({ label }) => `<th scope="col">${label}</th>`)
    .join('')
  const totalValues = activeTotalFields
    .map(({ key }) => `<td class="highlight">${totals[key as string]}</td>`)
    .join('')

  const columnCount = 12
    + (status === 'done' ? 1 : 0)
    + (showConsegnaStaff ? 1 : 0)
    + (showCleaningStaff ? 1 : 0)

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Ordini di Lavoro — Veda Bene</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; text-align: center; text-transform: uppercase; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #f0f0f0; text-align: center; padding: 5px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #ccc; }
    td { padding: 4px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; text-align: center; }
    tbody > tr { break-inside: avoid; page-break-inside: avoid; }
    tr:last-child td { border-bottom: none; }
    .highlight { font-weight: 700; color: #111; }
    .dim { color: #aaa; }
    .property-cell { text-align: left; font-weight: 700; }
    .datetime-cell { white-space: nowrap; }
    .same-day-time { font-weight: 700; }
    .urgent-time, .different-day-checkin-date { color: #b91c1c; }
    .different-day-checkin-date { font-weight: 700; }
    .status-summary { margin-bottom: 16px; text-align: center; }
    h2 { font-size: 13px; margin-bottom: 10px; }
    .totals-section { break-inside: avoid; page-break-inside: avoid; text-align: center; }
    .totals-table { width: auto; min-width: 480px; margin: 0 auto; border: 1px solid #d5d5d5; }
    .totals-table th, .totals-table td { min-width: 68px; padding: 8px 14px; border: 1px solid #dedede; text-align: center; }
    .totals-table th { color: #555; border-bottom-width: 1px; }
    .totals-table td { font-size: 12px; }
    .staff-cell { width: 9%; max-width: 110px; white-space: normal; overflow-wrap: anywhere; font-size: 9px; line-height: 1.25; color: #333; text-align: center; font-weight: 700; }
    .notes-cell { width: 22%; max-width: 220px; white-space: normal; word-break: break-word; font-size: 9px; color: #333; text-align: center; font-weight: 700; }
    .completion-cell { min-width: 105px; font-size: 9px; line-height: 1.35; }
    .completion-cell span { display: block; white-space: nowrap; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Veda Bene — Ordini di Lavoro ${STATUS_TITLES[status]}</h1>
  <p class="meta">Data: ${dateLabel} &nbsp;|&nbsp; Generato il: ${now}</p>
  ${statusSummaryHtml}
  <table>
    <thead>
      <tr>
        <th>O.L. #</th>
        <th>Immobile</th>
        <th>Check-in</th>
        <th>Check-out</th>
        ${status === 'done' ? `<th>${showWorkedTime ? 'Conclusione / Tempo' : 'Conclusione'}</th>` : ''}
        ${showCleaningStaff ? '<th class="staff-header">Utente</th>' : ''}
        ${showConsegnaStaff ? '<th class="staff-header">Consegna</th>' : ''}
        ${OCCUPANCY_FIELDS.map(({ label }) => `<th>${label}</th>`).join('')}
        <th class="notes-header">Note Pulizia</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${columnCount}" style="text-align:center;color:#999;padding:16px">Nessun O.L. trovato</td></tr>`}
    </tbody>
  </table>
  ${activeTotalFields.length > 0 ? `
  <section class="totals-section">
    <h2>Totali occupazione</h2>
    <table class="totals-table">
      <thead><tr>${totalHeaders}</tr></thead>
      <tbody><tr>${totalValues}</tr></tbody>
    </table>
  </section>` : ''}
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`

  return html
}

export function buildCheckinReportPdfHtml(
  orders: ServiceOrderListItem[],
  checkinDate: string,
  isCliente: boolean = false,
): string {
  // Ordenação cronológica por check-in
  const sortedOrders = [...orders].sort((a, b) => {
    const timeA = a.checkin_at ? new Date(a.checkin_at).getTime() : Number.MAX_SAFE_INTEGER
    const timeB = b.checkin_at ? new Date(b.checkin_at).getTime() : Number.MAX_SAFE_INTEGER
    if (timeA !== timeB) return timeA - timeB
    return a.order_number - b.order_number
  })

  const showConsegnaStaff = !isCliente && sortedOrders.some((order) => getConsegnaStaffName(order) !== '')
  const showCleaningStaff = !isCliente && sortedOrders.some((order) => getCleaningStaffNames(order) !== '')
  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })

  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length
  const openCount = orders.filter((o) => o.status === 'open').length
  const doneCount = orders.filter((o) => o.status === 'done').length
  const totalCount = orders.length

  const totals: Record<string, number> = {}
  for (const { key } of OCCUPANCY_FIELDS) {
    totals[key as string] = sortedOrders.reduce((sum, o) => sum + ((o[key] as number) ?? 0), 0)
  }
  const activeTotalFields = OCCUPANCY_FIELDS.filter(({ key }) => totals[key as string] > 0)

  const rows = sortedOrders.map((o) => {
    let statusHtml = ''
    if (o.status === 'done') {
      statusHtml = `
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#dcfce7;color:#15803d;font-weight:700;font-size:10px;">COMPLETATO</span>
        ${o.completed_at ? `<span style="display:block;font-size:9px;color:#333;margin-top:2px;font-weight:700;">Conclusa: ${formatDateTime(o.completed_at)}</span>` : ''}
      `
    } else if (o.status === 'in_progress') {
      statusHtml = `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-weight:700;font-size:10px;">IN CORSO</span>`
    } else {
      statusHtml = `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#b45309;font-weight:700;font-size:10px;">APERTO</span>`
    }

    return `
      <tr>
        <td>#${o.order_number}</td>
        <td class="property-cell">${escapeHtml(o.property?.name ?? '—')}</td>
        ${renderScheduleCells(o)}
        <td class="status-cell">${statusHtml}</td>
        ${showCleaningStaff ? `<td class="staff-cell">${escapeHtml(getCleaningStaffNames(o)) || '—'}</td>` : ''}
        ${showConsegnaStaff ? `<td class="staff-cell">${escapeHtml(getConsegnaStaffName(o)) || '—'}</td>` : ''}
        ${OCCUPANCY_FIELDS.map(({ key }) => {
          const val = (o[key] as number) ?? 0
          return `<td class="${val > 0 ? 'highlight' : 'dim'}">${val > 0 ? val : '—'}</td>`
        }).join('')}
        <td class="notes-cell">${o.cleaning_notes ? escapeHtml(o.cleaning_notes) : '—'}</td>
      </tr>
    `
  }).join('')

  const totalHeaders = activeTotalFields
    .map(({ label }) => `<th scope="col">${label}</th>`)
    .join('')
  const totalValues = activeTotalFields
    .map(({ key }) => `<td class="highlight">${totals[key as string]}</td>`)
    .join('')

  const columnCount = 13
    + (showConsegnaStaff ? 1 : 0)
    + (showCleaningStaff ? 1 : 0)

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Report Check-in — Veda Bene</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; text-align: center; text-transform: uppercase; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #f0f0f0; text-align: center; padding: 5px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #ccc; }
    td { padding: 4px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; text-align: center; }
    tbody > tr { break-inside: avoid; page-break-inside: avoid; }
    tr:last-child td { border-bottom: none; }
    .highlight { font-weight: 700; color: #111; }
    .dim { color: #aaa; }
    .property-cell { text-align: left; font-weight: 700; }
    .datetime-cell { white-space: nowrap; }
    .same-day-time { font-weight: 700; }
    .urgent-time, .different-day-checkin-date { color: #b91c1c; }
    .different-day-checkin-date { font-weight: 700; }
    .status-summary { margin-bottom: 16px; text-align: center; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; margin: 0 4px; font-size: 11px; }
    .status-cell { min-width: 110px; font-size: 9px; line-height: 1.35; }
    h2 { font-size: 13px; margin-bottom: 10px; }
    .totals-section { break-inside: avoid; page-break-inside: avoid; text-align: center; }
    .totals-table { width: auto; min-width: 480px; margin: 0 auto; border: 1px solid #d5d5d5; }
    .totals-table th, .totals-table td { min-width: 68px; padding: 8px 14px; border: 1px solid #dedede; text-align: center; }
    .totals-table th { color: #555; border-bottom-width: 1px; }
    .totals-table td { font-size: 12px; }
    .staff-cell { width: 9%; max-width: 110px; white-space: normal; overflow-wrap: anywhere; font-size: 9px; line-height: 1.25; color: #333; text-align: center; font-weight: 700; }
    .notes-cell { width: 22%; max-width: 220px; white-space: normal; word-break: break-word; font-size: 9px; color: #333; text-align: center; font-weight: 700; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Veda Bene — Report Check-in</h1>
  <p class="meta">Data Check-in: ${formatDate(checkinDate)} &nbsp;|&nbsp; Generato il: ${now} &nbsp;|&nbsp; Totale Immobili: ${totalCount}</p>
  
  <div class="status-summary">
    ${inProgressCount > 0 ? `<span class="status-badge" style="background:#e0f2fe;color:#0369a1;">In corso: ${inProgressCount}</span>` : ''}
    ${openCount > 0 ? `<span class="status-badge" style="background:#fef3c7;color:#b45309;">Aperti: ${openCount}</span>` : ''}
    ${doneCount > 0 ? `<span class="status-badge" style="background:#dcfce7;color:#15803d;">Completati: ${doneCount}</span>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>O.L. #</th>
        <th>Immobile</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Stato / Conclusione</th>
        ${showCleaningStaff ? '<th class="staff-header">Utente</th>' : ''}
        ${showConsegnaStaff ? '<th class="staff-header">Consegna</th>' : ''}
        ${OCCUPANCY_FIELDS.map(({ label }) => `<th>${label}</th>`).join('')}
        <th class="notes-header">Note Pulizia</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${columnCount}" style="text-align:center;color:#999;padding:16px">Nessun immobile con check-in in questa data</td></tr>`}
    </tbody>
  </table>

  ${activeTotalFields.length > 0 ? `
  <section class="totals-section">
    <h2>Totali occupazione</h2>
    <table class="totals-table">
      <thead><tr>${totalHeaders}</tr></thead>
      <tbody><tr>${totalValues}</tr></tbody>
    </table>
  </section>` : ''}

  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`

  return html
}

function generatePDF(
  orders: ServiceOrderListItem[],
  date: string,
  status: PdfStatus,
  dateLabel?: string,
  isCliente: boolean = false,
) {
  const html = buildServiceOrdersPdfHtml(orders, date, status, dateLabel, isCliente)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

function generateCheckinPDF(
  orders: ServiceOrderListItem[],
  checkinDate: string,
  isCliente: boolean = false,
) {
  const html = buildCheckinReportPdfHtml(orders, checkinDate, isCliente)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export function OrdersPdfButton({
  orders,
  date,
  dateLabel,
  status,
  isCliente = false,
  disabled = false,
}: {
  orders: ServiceOrderListItem[]
  date: string
  dateLabel?: string
  status: 'open' | 'in_progress' | 'done'
  isCliente?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => generatePDF(orders, date, status, dateLabel, isCliente)}
      className={`flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-md border ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-muted-foreground border-border/40 bg-muted/20'
          : 'text-muted-foreground hover:text-foreground border-border/60 hover:border-border hover:bg-muted/40'
      }`}
    >
      <FileDown size={14} />
      PDF
    </button>
  )
}

export function CheckinReportPdfButton({
  orders,
  checkinDate,
  isCliente = false,
  disabled = false,
}: {
  orders: ServiceOrderListItem[]
  checkinDate: string
  isCliente?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => generateCheckinPDF(orders, checkinDate, isCliente)}
      className={`flex items-center gap-1.5 text-xs font-semibold transition-all px-3.5 py-1.5 rounded-lg border shadow-sm ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-muted-foreground border-border/40 bg-muted/20'
          : 'text-accent hover:text-accent-hover bg-accent/10 hover:bg-accent/15 border-accent/30 hover:border-accent/50 active:scale-95'
      }`}
    >
      <FileDown size={14} className="text-accent" />
      Report Check-in (PDF)
    </button>
  )
}
