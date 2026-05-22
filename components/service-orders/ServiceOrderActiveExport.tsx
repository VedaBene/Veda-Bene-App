'use client'

import { FileDown } from 'lucide-react'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { formatDate, formatDateTime } from './display'

const OCCUPANCY_FIELDS: { key: keyof ServiceOrderListItem; label: string }[] = [
  { key: 'real_guests', label: 'Ospiti' },
  { key: 'double_beds', label: 'Letti Matrimoniali' },
  { key: 'single_beds', label: 'Letti Singoli' },
  { key: 'sofa_beds', label: 'Divani Letto' },
  { key: 'bathrooms', label: 'Bagni' },
  { key: 'bidets', label: 'Bidet' },
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

function generatePDF(orders: ServiceOrderListItem[], date: string) {
  const dateLabel = date ? formatDate(date) : 'Tutte le date'
  const now = new Date().toLocaleString('it-IT', { timeZone: 'UTC' })

  const totals: Record<string, number> = {}
  for (const { key } of OCCUPANCY_FIELDS) {
    totals[key as string] = orders.reduce((sum, o) => sum + ((o[key] as number) ?? 0), 0)
  }
  const activeTotalFields = OCCUPANCY_FIELDS.filter(({ key }) => totals[key as string] > 0)

  const rows = orders.map((o) => `
    <tr>
      <td>#${o.order_number}</td>
      <td>${escapeHtml(o.property?.name ?? '—')}</td>
      <td>${formatDateTime(o.checkin_at)}</td>
      <td>${formatDateTime(o.checkout_at)}</td>
      <td class="notes-cell">${o.cleaning_notes ? escapeHtml(o.cleaning_notes) : '—'}</td>
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
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #ccc; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .highlight { font-weight: 700; color: #111; }
    .dim { color: #aaa; }
    h2 { font-size: 13px; margin-bottom: 8px; }
    .totals-table { max-width: 300px; }
    .totals-table td:first-child { color: #555; }
    .totals-table td:last-child { font-weight: 700; text-align: right; }
    .notes-cell { max-width: 250px; white-space: normal; word-break: break-word; font-size: 10px; color: #333; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Veda Bene — Ordini di Lavoro Aperti</h1>
  <p class="meta">Data: ${dateLabel} &nbsp;|&nbsp; Generato il: ${now}</p>
  <table>
    <thead>
      <tr>
        <th>O.L. #</th>
        <th>Immobile</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Note Pulizia</th>
        ${OCCUPANCY_FIELDS.map(({ label }) => `<th>${label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="12" style="text-align:center;color:#999;padding:16px">Nessun O.L. trovato</td></tr>'}
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

export function ActiveOrdersPdfButton({
  orders,
  date,
}: {
  orders: ServiceOrderListItem[]
  date: string
}) {
  return (
    <button
      onClick={() => generatePDF(orders, date)}
      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border/60 hover:border-border hover:bg-muted/40"
    >
      <FileDown size={14} />
      PDF
    </button>
  )
}
