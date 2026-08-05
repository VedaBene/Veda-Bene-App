import type {
  PayableDetailRow,
  ReceivableReport,
  ReceivableSection,
} from '@/lib/types/reporting'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function printHTML(
  title: string,
  bodyHTML: string,
  options: { pageSize?: 'portrait' | 'landscape' } = {},
) {
  const win = window.open('', '_blank')
  if (!win) return
  const safeTitle = escapeHtml(title)

  win.document.write(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4 ${options.pageSize ?? 'portrait'}; margin: 9mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 16px; margin-bottom: 16px; }
    h2 { font-size: 13px; margin: 20px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 10px; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    tfoot td { font-weight: bold; border-top: 2px solid #d1d5db; }
    .num { text-align: right; }
    .muted { color: #6b7280; }
    .grand { margin-top: 16px; padding-top: 8px; border-top: 2px solid #111; font-weight: bold; }
    .receivable { font-size: 7px; color: #0f172a; }
    .receivable .report-meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 8px; color: #64748b; font-size: 8px; }
    .receivable .report-note { margin: 0 0 10px; padding: 6px 8px; background: #fff7e6; border: 1px solid #f2d79a; font-size: 7px; line-height: 1.35; }
    .receivable .receivable-section { margin-top: 10px; }
    .receivable .receivable-section.page-break { break-before: page; }
    .receivable .section-heading { margin: 0 0 5px; padding: 6px 8px; color: #fff; background: #0f9d91; font-size: 11px; }
    .receivable .section-heading.ripasso { background: #3867d6; }
    .receivable .section-heading.out-long-stay { background: #7c5cfc; }
    .receivable table { table-layout: fixed; margin-bottom: 0; }
    .receivable thead { display: table-header-group; }
    .receivable tfoot { display: table-row-group; }
    .receivable tr { break-inside: avoid; }
    .receivable th { padding: 4px 2px; border: 1px solid #dce4ec; background: #eef2f7; text-align: center; font-size: 5.6px; line-height: 1.15; }
    .receivable th.group { background: #0f172a; color: #fff; font-size: 5.8px; text-transform: uppercase; letter-spacing: .03em; }
    .receivable th.group.values { background: #0f9d91; }
    .receivable td { padding: 4px 2px; border: 1px solid #dce4ec; vertical-align: top; line-height: 1.2; overflow-wrap: anywhere; }
    .receivable td.center { text-align: center; }
    .receivable td.num { text-align: right; white-space: nowrap; }
    .receivable td.price-ref { background: #fff7e6; }
    .receivable td.description { white-space: normal; }
    .receivable tfoot td { background: #f8fafc; border-top: 2px solid #94a3b8; font-weight: bold; }
    .receivable .grand-total { display: flex; justify-content: space-between; align-items: center; margin-top: 9px; padding: 8px 10px; background: #0f172a; color: #fff; font-size: 10px; font-weight: bold; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${bodyHTML}
  <br/>
  <button onclick="window.print()">Stampa / Salva PDF</button>
  <script>setTimeout(() => window.print(), 300)</script>
</body>
</html>`)
  win.document.close()
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    }).format(d)
  } catch {
    return '-'
  }
}

function money(v: number | null | undefined): string {
  if (v == null) return '-'
  return `€ ${v.toFixed(2)}`
}

const receivableMoneyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function receivableMoney(value: number | null): string {
  return value == null ? '-' : receivableMoneyFormatter.format(value)
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : '-'
}

function escapeMultiline(value: string | null): string {
  return value ? escapeHtml(value).replace(/\r?\n/g, '<br/>') : '-'
}

function renderReceivableSection(
  title: string,
  headingClass: string,
  section: ReceivableSection,
  pageBreak: boolean,
): string {
  const rows = section.rows.map(row => `
    <tr>
      <td class="center">${formatDateOnly(row.cleaningDate)}</td>
      <td class="num">#${row.orderNumber}</td>
      <td>${escapeHtml(row.propertyName)}</td>
      <td>${escapeHtml(row.clientName)}</td>
      <td class="center">${row.occupancy.guests ?? '-'}</td>
      <td class="center">${row.occupancy.doubleBeds}</td>
      <td class="center">${row.occupancy.singleBeds}</td>
      <td class="center">${row.occupancy.sofaBeds}</td>
      <td class="center">${row.occupancy.bathrooms}</td>
      <td class="center">${row.occupancy.bidets}</td>
      <td class="center">${row.occupancy.cribs}</td>
      <td class="num price-ref">${receivableMoney(row.currentBasePrice)}</td>
      <td class="num price-ref">${receivableMoney(row.consideredAmount)}</td>
      <td class="description">${escapeMultiline(row.extraDescription)}</td>
      <td class="num">${receivableMoney(row.extraAmount)}</td>
      <td class="num">${receivableMoney(row.consegnaFee)}</td>
      <td class="num">${receivableMoney(row.totalPrice)}</td>
    </tr>`).join('')

  const emptyRow = `<tr><td colspan="17" class="muted" style="text-align:center;padding:14px">Nenhuma O.S. nesta modalidade para o período.</td></tr>`

  return `
    <section class="receivable-section${pageBreak ? ' page-break' : ''}">
      <h2 class="section-heading ${headingClass}">${escapeHtml(title)}</h2>
      <table>
        <colgroup>
          <col style="width:6%"><col style="width:4%"><col style="width:11%"><col style="width:8%">
          <col style="width:2.5%"><col style="width:2.5%"><col style="width:2.5%"><col style="width:2.5%"><col style="width:2.5%"><col style="width:2.5%"><col style="width:3%">
          <col style="width:8%"><col style="width:8%"><col style="width:18%"><col style="width:8%"><col style="width:6%"><col style="width:7.5%">
        </colgroup>
        <thead>
          <tr>
            <th class="group" colspan="4">Identificação</th>
            <th class="group" colspan="7">Ocupação</th>
            <th class="group values" colspan="6">Composição de valores</th>
          </tr>
          <tr>
            <th>Data</th><th>O.S.</th><th>Imóvel</th><th>Cliente</th>
            <th>PX</th><th>M</th><th>S</th><th>DL</th><th>WC</th><th>BI</th><th>CUL</th>
            <th>Preço base atual</th><th>Valor considerado</th><th>Descrição do serviço extra</th>
            <th>Valor do serviço extra</th><th>Consegna</th><th>Total O.S.</th>
          </tr>
        </thead>
        <tbody>${rows || emptyRow}</tbody>
        <tfoot>
          <tr>
            <td colspan="11">Subtotal - ${section.orderCount} O.S.</td>
            <td></td>
            <td class="num">${receivableMoney(section.consideredTotal)}</td>
            <td>Serviços extras</td>
            <td class="num">${receivableMoney(section.extraTotal)}</td>
            <td class="num">${receivableMoney(section.consegnaTotal)}</td>
            <td class="num">${receivableMoney(section.sectionTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`
}

export function buildReceivablePrintBody(report: ReceivableReport): string {
  return `
    <div class="receivable">
      <div class="report-meta">
        <strong>Veda Bene - Extrato a Receber</strong>
        <span>Período: ${formatDateOnly(report.period.startDate)} - ${formatDateOnly(report.period.endDate)}</span>
      </div>
      <p class="report-note">
        Preço base atual é uma referência do imóvel. Valor considerado representa o componente da modalidade antes do serviço extra e da Consegna. O total financeiro permanece o Total O.S.
      </p>
      ${renderReceivableSection('1. Standard', '', report.standard, false)}
      ${renderReceivableSection('2. Ripasso', 'ripasso', report.ripasso, true)}
      ${renderReceivableSection('3. Out Long Stay', 'out-long-stay', report.outLongStay, true)}
      <div class="grand-total"><span>Total geral</span><span>${receivableMoney(report.grandTotal)}</span></div>
    </div>`
}

export function exportReceivablePDF(report: ReceivableReport) {
  if (report.pendingCount > 0) {
    throw new Error(
      `Exportação bloqueada: existem ${report.pendingCount} O.S. com dados financeiros pendentes neste filtro.`,
    )
  }

  printHTML(
    'Extrato a Receber - Veda Bene',
    buildReceivablePrintBody(report),
    { pageSize: 'landscape' },
  )
}

type PayableGroup = {
  employee_id: string
  employee_name: string
  monthly_salary: number | null
  hourly_rate: number | null
  rows: PayableDetailRow[]
  totalHours: number
  totalPayable: number
}

function groupPayable(data: PayableDetailRow[]): PayableGroup[] {
  const map = new Map<string, PayableGroup>()
  for (const r of data) {
    let g = map.get(r.employee_id)
    if (!g) {
      g = {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        monthly_salary: r.monthly_salary,
        hourly_rate: r.hourly_rate,
        rows: [],
        totalHours: 0,
        totalPayable: 0,
      }
      map.set(r.employee_id, g)
    }
    g.rows.push(r)
    g.totalHours += r.hours
    if (r.os_total != null) g.totalPayable += r.os_total
  }
  const groups = [...map.values()]
  for (const g of groups) {
    g.totalHours = Math.round(g.totalHours * 100) / 100
    if (g.monthly_salary != null) {
      g.totalPayable = g.monthly_salary
    } else {
      g.totalPayable = Math.round(g.totalPayable * 100) / 100
    }
  }
  groups.sort((a, b) => a.employee_name.localeCompare(b.employee_name))
  return groups
}

export function exportPayablePDF(
  data: PayableDetailRow[],
  startDate: string,
  endDate: string,
  employeeName?: string,
) {
  const title = employeeName
    ? `Estratto da pagare - ${employeeName} - Veda Bene`
    : 'Estratto da pagare - Veda Bene'

  printHTML(title, buildPayablePrintBody(data, startDate, endDate, employeeName))
}

export function buildPayablePrintBody(
  data: PayableDetailRow[],
  startDate: string,
  endDate: string,
  employeeName?: string,
): string {
  const groups = groupPayable(data)

  const sections = groups.map(g => {
    const rows = g.rows.map(r => `
      <tr>
        <td>${formatDate(r.completed_at)}</td>
        <td>#${r.order_number}</td>
        <td>${escapeHtml(r.property_name)}</td>
        <td class="num">${r.hours.toFixed(2)} h</td>
        <td class="num">${money(r.hourly_rate)}</td>
        <td class="num">${money(r.os_total)}</td>
      </tr>`).join('')

    const fixedNote = g.monthly_salary != null
      ? `<p class="muted" style="margin:2px 0 6px">Stipendio fisso: ${money(g.monthly_salary)} - i totali per O.L. non si applicano.</p>`
      : ''

    return `
      <h2>Dipendente: ${escapeHtml(g.employee_name)}</h2>
      ${fixedNote}
      <table>
        <thead>
          <tr>
            <th>Data O.L.</th>
            <th>Numero O.L.</th>
            <th>Immobile/i</th>
            <th class="num">Ore da pagare</th>
            <th class="num">Tariffa oraria</th>
            <th class="num">Totale per O.L.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Totale ore da pagare</td>
            <td class="num">${g.totalHours.toFixed(2)} h</td>
            <td></td>
            <td class="num">${money(g.totalPayable)}</td>
          </tr>
        </tfoot>
      </table>`
  }).join('')

  const showGrand = !employeeName && groups.length > 1
  const grandHours = groups.reduce((s, g) => s + g.totalHours, 0)
  const grandPayable = groups.reduce((s, g) => s + g.totalPayable, 0)
  const grandBlock = showGrand
    ? `<div class="grand">
         Totale generale delle ore da pagare: ${grandHours.toFixed(2)} h &nbsp;·&nbsp;
         Totale generale da pagare: ${money(grandPayable)}
       </div>`
    : ''

  const empty = groups.length === 0
    ? `<p class="muted" style="text-align:center;padding:20px">Nessun dato trovato per il periodo.</p>`
    : ''

  return `
    <p class="muted" style="margin-bottom:12px">Periodo: ${formatDateOnly(startDate)} → ${formatDateOnly(endDate)}</p>
    ${empty}
    ${sections}
    ${grandBlock}`
}
