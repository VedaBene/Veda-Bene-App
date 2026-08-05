import { describe, expect, it } from 'vitest'
import {
  buildPayablePrintBody,
  buildReceivablePrintBody,
  exportReceivablePDF,
} from './export-pdf'
import type { PayableDetailRow, ReceivableReport } from '@/lib/types/reporting'

const payableRows: PayableDetailRow[] = [
  {
    employee_id: 'employee-1',
    employee_name: 'Allen & Figli',
    order_id: 'order-834',
    order_number: 834,
    completed_at: '2026-08-01T10:00:00.000Z',
    property_name: 'Aurelia <Sunset>',
    hours: 3,
    hourly_rate: 12.5,
    monthly_salary: null,
    os_total: 37.5,
  },
]

const report: ReceivableReport = {
  period: { startDate: '2026-05-01', endDate: '2026-05-31' },
  standard: {
    mode: 'standard',
    rows: [{
      section: 'standard',
      orderId: 'order-1',
      orderNumber: 1,
      financialStatus: 'complete',
      pendingReason: null,
      cleaningDate: '2026-05-10',
      propertyName: '<script>alert(1)</script>',
      clientName: 'Rental & Co.',
      occupancy: { guests: 4, doubleBeds: 2, singleBeds: 0, sofaBeds: 1, bathrooms: 2, bidets: 1, cribs: 0 },
      currentBasePrice: 110,
      consideredAmount: 123,
      extraDescription: 'Linha 1\n<img src=x onerror=alert(1)>',
      extraAmount: 15,
      consegnaFee: 10,
      totalPrice: 148,
    }],
    orderCount: 1,
    completeOrderCount: 1,
    pendingCount: 0,
    consideredTotal: 123,
    extraTotal: 15,
    consegnaTotal: 10,
    sectionTotal: 148,
  },
  ripasso: { mode: 'ripasso', rows: [], orderCount: 0, completeOrderCount: 0, pendingCount: 0, consideredTotal: 0, extraTotal: 0, consegnaTotal: 0, sectionTotal: 0 },
  outLongStay: { mode: 'out_long_stay', rows: [], orderCount: 0, completeOrderCount: 0, pendingCount: 0, consideredTotal: 0, extraTotal: 0, consegnaTotal: 0, sectionTotal: 0 },
  orderCount: 1,
  completeOrderCount: 1,
  pendingCount: 0,
  grandTotal: 148,
}

describe('payable PDF formatter', () => {
  it('renders the per-order report structure and all payable labels in Italian', () => {
    const html = buildPayablePrintBody(payableRows, '2026-08-01', '2026-08-05')

    expect(html).toContain('Periodo: 01/08/2026 → 05/08/2026')
    expect(html).toContain('Dipendente: Allen &amp; Figli')
    expect(html).toContain('Data O.L.')
    expect(html).toContain('Numero O.L.')
    expect(html).toContain('Immobile/i')
    expect(html).toContain('Ore da pagare')
    expect(html).toContain('Tariffa oraria')
    expect(html).toContain('Totale per O.L.')
    expect(html).toContain('Aurelia &lt;Sunset&gt;')
    expect(html).not.toContain('Funcionário')
    expect(html).not.toContain('Tempo para Pagamento')
  })
})

describe('receivable PDF formatter', () => {
  it('renders exactly the three pricing sections and the approved columns', () => {
    const html = buildReceivablePrintBody(report)

    expect(html).toContain('1. Standard')
    expect(html).toContain('2. Ripasso')
    expect(html).toContain('3. Out Long Stay')
    expect(html).toContain('Preço base atual')
    expect(html).toContain('Valor considerado')
    expect(html).toContain('Descrição do serviço extra')
    expect(html).not.toContain('4. Extras')
  })

  it('escapes names and multiline service descriptions before writing HTML', () => {
    const html = buildReceivablePrintBody(report)

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Rental &amp; Co.')
    expect(html).toContain('Linha 1<br/>&lt;img src=x onerror=alert(1)&gt;')
  })

  it('blocks PDF generation when the report has financial pendencies', () => {
    expect(() => exportReceivablePDF({ ...report, pendingCount: 1 }))
      .toThrow('Exportação bloqueada: existem 1 O.S. com dados financeiros pendentes neste filtro.')
  })
})
