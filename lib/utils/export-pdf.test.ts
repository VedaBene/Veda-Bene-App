import { describe, expect, it } from 'vitest'
import { buildReceivablePrintBody, exportReceivablePDF } from './export-pdf'
import type { ReceivableReport } from '@/lib/types/reporting'

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
