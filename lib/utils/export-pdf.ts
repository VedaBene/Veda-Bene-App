import type { PayableRow, ReceivableRow } from '@/app/(app)/statements/actions'

function printHTML(title: string, tableHTML: string) {
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
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 6px 10px; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    tfoot td { font-weight: bold; border-top: 2px solid #d1d5db; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${tableHTML}
  <br/>
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
  <script>setTimeout(() => window.print(), 300)</script>
</body>
</html>`)
  win.document.close()
}

export function exportPayablePDF(data: PayableRow[], startDate: string, endDate: string, employeeName?: string) {
  const total = data.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

  const rows = data.map(r => `
    <tr>
      <td>${r.full_name}</td>
      <td>${r.os_count}</td>
      <td>${r.total_hours.toFixed(2)}</td>
      <td>${r.hourly_rate != null ? `€ ${r.hourly_rate.toFixed(2)}` : '—'}</td>
      <td>${r.monthly_salary != null ? `€ ${r.monthly_salary.toFixed(2)}` : '—'}</td>
      <td>${r.total_amount != null ? `€ ${r.total_amount.toFixed(2)}` : '—'}</td>
    </tr>`).join('')

  const subtitle = employeeName
    ? `<p style="margin-bottom:4px;color:#6b7280">Funcionário: <strong>${employeeName}</strong></p>`
    : ''

  const table = `
    ${subtitle}
    <p style="margin-bottom:12px;color:#6b7280">Período: ${startDate} → ${endDate}</p>
    <table>
      <thead>
        <tr>
          <th>Funcionário</th><th>Total OS</th><th>Total Horas</th>
          <th>Valor/Hora</th><th>Salário Fixo</th><th>Total a Pagar</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">Total Geral</td>
          <td>€ ${total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>`

  const title = employeeName
    ? `Extrato a Pagar — ${employeeName} — Veda Bene`
    : 'Extrato a Pagar — Veda Bene'

  printHTML(title, table)
}

export function exportReceivablePDF(data: ReceivableRow[], startDate: string, endDate: string) {
  const total = data.reduce((sum, r) => sum + r.total_value, 0)

  const rows = data.map(r => `
    <tr>
      <td>${r.client_name}</td>
      <td>${r.client_type === 'rental' ? 'Agência' : 'Particular'}</td>
      <td>${r.property_name}</td>
      <td>${r.os_count}</td>
      <td>€ ${r.total_value.toFixed(2)}</td>
    </tr>`).join('')

  const table = `
    <p style="margin-bottom:12px;color:#6b7280">Período: ${startDate} → ${endDate}</p>
    <table>
      <thead>
        <tr>
          <th>Cliente</th><th>Tipo</th><th>Imóvel</th><th>Total OS</th><th>Total (€)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4">Total Geral</td>
          <td>€ ${total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>`

  printHTML('Extrato a Receber — Veda Bene', table)
}
