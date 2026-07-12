'use client'

import { FileDown } from 'lucide-react'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { formatDate, formatDateTime } from './display'
import { formatWorkedTime } from './LiveTimer'
import { compareServiceOrderPriority } from './ordering'

const OCCUPANCY_FIELDS: { key: keyof ServiceOrderListItem; label: string }[] = [
  { key: 'real_guests', label: 'PX' },
  { key: 'double_beds', label: 'M' },
  { key: 'single_beds', label: 'S' },
  { key: 'sofa_beds', label: 'DC' },
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

function generatePDF(orders: ServiceOrderListItem[], date: string, status: 'open' | 'in_progress' | 'done') {
  const sortedOrders = status !== 'done' ? [...orders].sort(compareServiceOrderPriority) : orders
  
  let dateLabel = 'Tutte le date'
  if (date) {
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
      statusSummaryHtml = `<div style="margin-bottom: 16px;">${badges.join('')}</div>`
    }
  } else if (status === 'done') {
    statusSummaryHtml = `<div style="margin-bottom: 16px;">
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
      <td>${escapeHtml(o.property?.name ?? '—')}</td>
      <td>${formatDateTime(o.checkin_at)}</td>
      <td>${formatDateTime(o.checkout_at)}</td>
      <td class="notes-cell">${o.cleaning_notes ? escapeHtml(o.cleaning_notes) : '—'}</td>
      ${status === 'done' ? `<td class="completion-cell">
        <span><strong>Conclusa:</strong> ${formatDateTime(o.completed_at)}</span>
        <span><strong>Tempo:</strong> ${o.worked_minutes != null ? formatWorkedTime(o.worked_minutes) : '—'}</span>
      </td>` : ''}
      ${OCCUPANCY_FIELDS.map(({ key }) => {
        const val = (o[key] as number) ?? 0
        return `<td class="${val > 0 ? 'highlight' : 'dim'}">${val > 0 ? val : '—'}</td>`
      }).join('')}
    </tr>
  `).join('')

  const totalRows = activeTotalFields.map(({ key, label }) => `
    <tr>
      <td>${label}</td>
      <td class="highlight">${totals[key as string]}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Ordini di Lavoro — Veda Bene</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #f0f0f0; text-align: center; padding: 5px 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #ccc; }
    td { padding: 4px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; text-align: center; }
    th:nth-child(2), td:nth-child(2), th:nth-child(5), td:nth-child(5) { text-align: left; }
    tr:last-child td { border-bottom: none; }
    .highlight { font-weight: 700; color: #111; }
    .dim { color: #aaa; }
    h2 { font-size: 13px; margin-bottom: 8px; }
    .totals-table { max-width: 300px; }
    .totals-table td:first-child { color: #555; }
    .totals-table td:last-child { font-weight: 700; text-align: right; }
    .notes-cell { width: 22%; max-width: 220px; white-space: normal; word-break: break-word; font-size: 9px; color: #333; }
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
        <th>Note Pulizia</th>
        ${status === 'done' ? '<th>Conclusione / Tempo</th>' : ''}
        ${OCCUPANCY_FIELDS.map(({ label }) => `<th>${label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${12 + (status === 'done' ? 1 : 0)}" style="text-align:center;color:#999;padding:16px">Nessun O.L. trovato</td></tr>`}
    </tbody>
  </table>
  ${activeTotalFields.length > 0 ? `
  <h2>Totali</h2>
  <table class="totals-table">
    <tbody>${totalRows}</tbody>
  </table>` : ''}
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export function OrdersPdfButton({
  orders,
  date,
  status,
  disabled = false,
}: {
  orders: ServiceOrderListItem[]
  date: string
  status: 'open' | 'in_progress' | 'done'
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => generatePDF(orders, date, status)}
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
