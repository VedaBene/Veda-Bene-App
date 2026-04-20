import type { ReceivableDetailRow, PayableDetailRow } from '@/app/(app)/statements/actions'

function printHTML(title: string, bodyHTML: string) {
  const win = window.open('', '_blank')
  if (!win) return

  win.document.write(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
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
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${bodyHTML}
  <br/>
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
  <script>setTimeout(() => window.print(), 300)</script>
</body>
</html>`)
  win.document.close()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function money(v: number | null | undefined): string {
  if (v == null) return '—'
  return `€ ${v.toFixed(2)}`
}

export function exportReceivablePDF(
  data: ReceivableDetailRow[],
  startDate: string,
  endDate: string,
) {
  const total = data.reduce((sum, r) => sum + r.total_price, 0)

  const rows = data.map(r => `
    <tr>
      <td>${formatDate(r.completed_at)}</td>
      <td>#${r.order_number}</td>
      <td>${escapeHtml(r.property_name)}</td>
      <td>${r.client_type === 'rental' ? 'Agência' : 'Particular'}</td>
      <td>${escapeHtml(r.client_name)}</td>
      <td class="num">${r.real_guests ?? '—'}</td>
      <td class="num">${money(r.extra_services_price)}</td>
      <td class="num">${money(r.total_price)}</td>
    </tr>`).join('')

  const body = `
    <p class="muted" style="margin-bottom:12px">Período: ${startDate} → ${endDate}</p>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>OS</th>
          <th>Imóvel</th>
          <th>Tipo</th>
          <th>Cliente</th>
          <th class="num">Hóspedes</th>
          <th class="num">Valor Extra</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="8" class="muted" style="text-align:center;padding:20px">Nenhum dado encontrado para o período.</td></tr>`}</tbody>
      ${data.length > 0 ? `
      <tfoot>
        <tr>
          <td colspan="7">Total Geral</td>
          <td class="num">${money(total)}</td>
        </tr>
      </tfoot>` : ''}
    </table>`

  printHTML('Extrato a Receber — Veda Bene', body)
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
      ? `<p class="muted" style="margin:2px 0 6px">Salário fixo: ${money(g.monthly_salary)} — totais por OS não se aplicam.</p>`
      : ''

    return `
      <h2>Funcionário: ${escapeHtml(g.employee_name)}</h2>
      ${fixedNote}
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>OS</th>
            <th>Imóvel</th>
            <th class="num">Tempo de Execução</th>
            <th class="num">Valor/Hora</th>
            <th class="num">Total por OS</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total de Horas Trabalhadas</td>
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
         Total Geral de Horas: ${grandHours.toFixed(2)} h &nbsp;·&nbsp;
         Total Geral a Pagar: ${money(grandPayable)}
       </div>`
    : ''

  const empty = groups.length === 0
    ? `<p class="muted" style="text-align:center;padding:20px">Nenhum dado encontrado para o período.</p>`
    : ''

  const subtitle = employeeName
    ? `<p class="muted" style="margin-bottom:4px">Funcionário: <strong>${escapeHtml(employeeName)}</strong></p>`
    : ''

  const body = `
    ${subtitle}
    <p class="muted" style="margin-bottom:12px">Período: ${startDate} → ${endDate}</p>
    ${empty}
    ${sections}
    ${grandBlock}`

  const title = employeeName
    ? `Extrato a Pagar — ${employeeName} — Veda Bene`
    : 'Extrato a Pagar — Veda Bene'

  printHTML(title, body)
}
