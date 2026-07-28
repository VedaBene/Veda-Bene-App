import { describe, expect, it } from 'vitest'
import { formatReceivableCSV } from './export-csv'
import type { ReceivableReport } from '@/lib/types/reporting'

const report: ReceivableReport = {
  period: { startDate: '2026-05-01', endDate: '2026-05-31' },
  standard: {
    mode: 'standard',
    rows: [{
      section: 'standard',
      orderId: 'order-1',
      orderNumber: 1,
      cleaningDate: '2026-05-10',
      propertyName: '=HYPERLINK("evil")',
      clientName: 'Rental',
      occupancy: { guests: 4, doubleBeds: 2, singleBeds: 0, sofaBeds: 1, bathrooms: 2, bidets: 1, cribs: 0 },
      currentBasePrice: 110,
      consideredAmount: 123,
      extraDescription: 'Asciugamani\nPreparazione letto',
      extraAmount: 15,
      consegnaFee: 10,
      totalPrice: 148,
    }],
    orderCount: 1,
    consideredTotal: 123,
    extraTotal: 15,
    consegnaTotal: 10,
    sectionTotal: 148,
  },
  ripasso: {
    mode: 'ripasso', rows: [], orderCount: 0, consideredTotal: 0,
    extraTotal: 0, consegnaTotal: 0, sectionTotal: 0,
  },
  outLongStay: {
    mode: 'out_long_stay', rows: [], orderCount: 0, consideredTotal: 0,
    extraTotal: 0, consegnaTotal: 0, sectionTotal: 0,
  },
  grandTotal: 148,
}

describe('receivable CSV formatter', () => {
  it('exports the transactional columns and preserves numeric money values', () => {
    const csv = formatReceivableCSV(report)
    const [header] = csv.split('\n', 1)

    expect(header).toBe('Sezione,Data,Numero OS,Cliente,Immobile,PX,M,S,DL,WC,BI,CUL,Prezzo base attuale,Valore considerato,Descrizione servizio extra,Valore servizio extra,Consegna,Totale OS')
    expect(csv).toContain('Standard,2026-05-10,1,Rental')
    expect(csv).toContain(',110,123,')
    expect(csv).toContain(',15,10,148')
  })

  it('escapes multiline descriptions and neutralizes spreadsheet formulas', () => {
    const csv = formatReceivableCSV(report)

    expect(csv).toContain('"\'=HYPERLINK(""evil"")"')
    expect(csv).toContain('"Asciugamani\nPreparazione letto"')
  })
})
