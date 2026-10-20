import { describe, expect, it } from 'vitest'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import {
  buildCheckinReportPdfHtml,
  buildServiceOrdersPdfHtml,
} from './ServiceOrderActiveExport'

function order(overrides: Partial<ServiceOrderListItem> = {}): ServiceOrderListItem {
  return {
    id: 'order-1',
    cleaning_staff_id: 'cleaner-1',
    cleaning_staff_ids: ['cleaner-1'],
    consegna_staff_id: 'delivery-1',
    cleaning_date: '2026-08-05',
    checkout_at: '2026-08-05T08:00:00Z',
    checkin_at: '2026-08-05T14:00:00Z',
    status: 'open',
    real_guests: 4,
    double_beds: 2,
    single_beds: 1,
    sofa_beds: 1,
    armchair_beds: 0,
    bathrooms: 2,
    bidets: 1,
    cribs: 0,
    order_number: 101,
    is_urgent: false,
    started_at: null,
    completed_at: null,
    worked_minutes: null,
    pricing_mode: 'standard',
    cleaning_notes: 'Portare i set',
    property: { id: 'property-1', name: 'Casa Roma', avg_cleaning_hours: 3 },
    cleaning_staff: [
      { id: 'cleaner-1', full_name: 'Ana Rossi' },
      { id: 'cleaner-2', full_name: 'Lia <Bianchi>' },
    ],
    consegna_staff: { id: 'delivery-1', full_name: 'Marco & Figlio' },
    ...overrides,
  }
}

function readPdfTables(html: string) {
  return [...html.matchAll(/<table(?:\s[^>]*)?>([\s\S]*?)<\/table>/g)].map(([, table]) => {
    const headers = [...table.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)]
      .map(([, value]) => value.trim())
    const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
      [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)].map(([, value]) => value.trim()),
    )
    return { headers, rows }
  })
}

const occupancyReports: {
  name: string
  build: (orders: ServiceOrderListItem[]) => string
}[] = [
  ...(['open', 'in_progress', 'done'] as const).map(status => ({
    name: status,
    build: (orders: ServiceOrderListItem[]) => buildServiceOrdersPdfHtml(
      orders.map(item => ({ ...item, status })), '2026-08-05', status,
    ),
  })),
  { name: 'check-in', build: orders => buildCheckinReportPdfHtml(orders, '2026-08-05') },
]

describe.each(occupancyReports)('$name PDF armchair-bed occupancy', ({ build }) => {
  it('places PL after DL and totals armchair beds independently of other occupancy', () => {
    const [main, totals] = readPdfTables(build([
      order({ single_beds: 3, sofa_beds: 4, armchair_beds: 5 }),
      order({ id: 'order-2', order_number: 102, single_beds: 7, sofa_beds: 11, armchair_beds: 13 }),
    ]))

    const plIndex = main.headers.indexOf('PL')
    expect(plIndex).toBe(main.headers.indexOf('DL') + 1)
    expect(main.headers[plIndex + 1]).toBe('WC')
    expect(Object.fromEntries(main.rows.map(row => [row[0], row[plIndex]])))
      .toEqual({ '#101': '5', '#102': '13' })
    expect(main.rows.every(row => row.length === main.headers.length)).toBe(true)
    expect(totals.headers).toEqual(['PX', 'M', 'S', 'DL', 'PL', 'WC', 'BID'])
    expect(totals.rows).toEqual([['8', '4', '10', '15', '18', '4', '2']])
  })

  it('keeps the PL column but omits its total when no armchair beds are used', () => {
    const [main, totals] = readPdfTables(build([order({ armchair_beds: 0 })]))

    expect(main.headers).toContain('PL')
    expect(main.rows[0][main.headers.indexOf('PL')]).toBe('—')
    expect(totals.headers).not.toContain('PL')
  })

  it('renders the occupancy summary when armchair beds are the only positive field', () => {
    const [main, totals] = readPdfTables(build([order({
      real_guests: null,
      double_beds: 0,
      single_beds: 0,
      sofa_beds: 0,
      armchair_beds: 2,
      bathrooms: 0,
      bidets: 0,
      cribs: 0,
    })]))

    expect(main.rows[0][main.headers.indexOf('PL')]).toBe('2')
    expect(totals.headers).toEqual(['PL'])
    expect(totals.rows).toEqual([['2']])
  })

  it('spans all columns including PL when the report is empty', () => {
    const html = build([])
    const [main] = readPdfTables(html)

    expect(main.headers).toContain('PL')
    expect(html).toContain(`<td colspan="${main.headers.length}"`)
    expect(html).not.toContain('<section class="totals-section">')
  })
})

describe('service-order PDF staff columns', () => {
  it('uses the canonical Utente, Consegna and occupancy column order', () => {
    const html = buildServiceOrdersPdfHtml([order()], '2026-08-05', 'open')

    const checkoutHeader = html.indexOf('<th>Check-out</th>')
    const cleaningHeader = html.indexOf('<th class="staff-header">Utente</th>')
    const consegnaHeader = html.indexOf('<th class="staff-header">Consegna</th>')
    const firstOccupancyHeader = html.indexOf('<th>PX</th>')
    const lastOccupancyHeader = html.indexOf('<th>Culle</th>')
    const notesHeader = html.indexOf('<th class="notes-header">Note Pulizia</th>')

    expect(cleaningHeader).toBeGreaterThan(checkoutHeader)
    expect(consegnaHeader).toBeGreaterThan(cleaningHeader)
    expect(consegnaHeader).toBeGreaterThan(-1)
    expect(consegnaHeader).toBeLessThan(firstOccupancyHeader)
    expect(notesHeader).toBeGreaterThan(lastOccupancyHeader)
    expect(html).not.toContain('<th class="staff-header">Pulizia</th>')
  })

  it('renders multiple names safely and keeps missing assignments explicit', () => {
    const html = buildServiceOrdersPdfHtml([
      order(),
      order({
        id: 'order-2',
        order_number: 102,
        cleaning_staff: [],
        consegna_staff: null,
      }),
    ], '2026-08-05', 'open')

    expect(html).toContain('Marco &amp; Figlio')
    expect(html).toContain('Ana Rossi, Lia &lt;Bianchi&gt;')
    expect(html.match(/<td class="staff-cell">—<\/td>/g)).toHaveLength(2)
    expect(html).toContain('.staff-cell { width: 9%; max-width: 110px; white-space: normal; overflow-wrap: anywhere; font-size: 9px; line-height: 1.25; color: #333; text-align: center; font-weight: 700; }')
    expect(html).toContain('.notes-cell { width: 22%; max-width: 220px; white-space: normal; word-break: break-word; font-size: 9px; color: #333; text-align: center; font-weight: 700; }')
  })

  it('omits both staff columns when names are unavailable or redacted', () => {
    const html = buildServiceOrdersPdfHtml([
      order({ cleaning_staff: [], consegna_staff: null }),
    ], '2026-08-05', 'open')

    expect(html).not.toContain('<th class="staff-header">Consegna</th>')
    expect(html).not.toContain('<th class="staff-header">Utente</th>')
  })

  it('formats compact Check-in and Check-out on one line in Rome', () => {
    const html = buildServiceOrdersPdfHtml([order()], '2026-08-05', 'open')

    expect(html).toContain('<td class="datetime-cell"><span class="date-part">05/08</span> <span class="time-part same-day-time">16:00</span></td>')
    expect(html).toContain('<td class="datetime-cell"><span class="time-part same-day-time">10:00</span> <span class="date-part">05/08</span></td>')
    expect(html).toContain('.datetime-cell { white-space: nowrap; }')
    expect(html).not.toContain('05/08/2026, 16:00')
    expect(html).not.toContain('10:00 - 05/08/2026')
  })

  it('left-aligns and bolds property names while preserving HTML escaping', () => {
    const html = buildServiceOrdersPdfHtml([
      order({ property: { id: 'property-1', name: 'Casa <Roma>', avg_cleaning_hours: 3 } }),
    ], '2026-08-05', 'open')

    expect(html).toContain('<td class="property-cell">Casa &lt;Roma&gt;</td>')
    expect(html).toContain('.property-cell { text-align: left; font-weight: 700; }')
  })

  it('renders urgent same-day times in red and bold for active orders', () => {
    const html = buildServiceOrdersPdfHtml([
      order({
        checkout_at: '2026-08-05T08:00:00Z',
        checkin_at: '2026-08-05T11:00:00Z',
        is_urgent: true,
      }),
    ], '2026-08-05', 'open')

    expect(html.match(/class="time-part same-day-time urgent-time"/g)).toHaveLength(2)
    expect(html).not.toContain('class="date-part different-day-checkin-date"')
  })

  it('highlights only the Check-in date when the Rome calendar day changes', () => {
    const html = buildServiceOrdersPdfHtml([
      order({
        checkout_at: '2026-08-05T20:00:00Z',
        checkin_at: '2026-08-06T01:00:00Z',
      }),
    ], '2026-08-05', 'open')

    expect(html).toContain('<span class="date-part different-day-checkin-date">06/08</span> <span class="time-part">03:00</span>')
    expect(html).toContain('<span class="time-part">22:00</span> <span class="date-part">05/08</span>')
    expect(html).not.toContain('class="time-part same-day-time')
    expect(html).not.toContain('class="time-part urgent-time"')
  })

  it('keeps cross-midnight urgent times red without making them bold', () => {
    const html = buildServiceOrdersPdfHtml([
      order({
        checkout_at: '2026-08-05T21:30:00Z',
        checkin_at: '2026-08-05T23:30:00Z',
        is_urgent: true,
      }),
    ], '2026-08-05', 'open')

    expect(html).toContain('<span class="date-part different-day-checkin-date">06/08</span> <span class="time-part urgent-time">01:30</span>')
    expect(html).toContain('<span class="time-part urgent-time">23:30</span> <span class="date-part">05/08</span>')
    expect(html).not.toContain('class="time-part same-day-time')
  })

  it('does not show historical urgency in completed PDFs', () => {
    const html = buildServiceOrdersPdfHtml([
      order({
        status: 'done',
        checkout_at: '2026-08-05T21:30:00Z',
        checkin_at: '2026-08-05T23:30:00Z',
        is_urgent: true,
      }),
    ], '2026-08-05', 'done')

    expect(html).toContain('class="date-part different-day-checkin-date"')
    expect(html).not.toContain('class="time-part urgent-time"')
  })

  it('centers and uppercases the document and renders totals horizontally', () => {
    const html = buildServiceOrdersPdfHtml([order()], '2026-08-05', 'open')

    expect(html).toContain('text-align: center; text-transform: uppercase;')
    expect(html).toContain('font-size: 11px; text-transform: uppercase;')
    expect(html).toContain('tbody > tr { break-inside: avoid; page-break-inside: avoid; }')
    expect(html).toContain('<h2>Totali occupazione</h2>')
    expect(html).toContain('<thead><tr><th scope="col">PX</th><th scope="col">M</th>')
    expect(html).toContain('<tbody><tr><td class="highlight">4</td><td class="highlight">2</td>')
  })

  it('uses an explicit today visibility label instead of claiming all dates', () => {
    const html = buildServiceOrdersPdfHtml(
      [order()],
      '',
      'open',
      'Fino al 07/08/2026 (Oggi)',
    )

    expect(html).toContain('Data: Fino al 07/08/2026 (Oggi)')
    expect(html).not.toContain('Data: Tutte le date')
  })

  it('omits worked time from completed orders when isCliente is true', () => {
    const doneOrder = order({
      status: 'done',
      completed_at: '2026-08-05T12:48:00Z',
      worked_minutes: 106,
    })

    const clientHtml = buildServiceOrdersPdfHtml([doneOrder], '2026-08-05', 'done', undefined, true)
    expect(clientHtml).toContain('Conclusa:')
    expect(clientHtml).not.toContain('Tempo:')
    expect(clientHtml).toContain('<th>Conclusione</th>')
    expect(clientHtml).not.toContain('<th>Conclusione / Tempo</th>')

    const adminHtml = buildServiceOrdersPdfHtml([doneOrder], '2026-08-05', 'done', undefined, false)
    expect(adminHtml).toContain('Conclusa:')
    expect(adminHtml).toContain('Tempo:')
    expect(adminHtml).toContain('1h 46min')
  })
})

describe('buildCheckinReportPdfHtml', () => {
  it('generates a unified check-in PDF with all statuses, badges, and totals', () => {
    const inProgressOrder = order({
      id: 'o-1',
      order_number: 1252,
      property: { id: 'p-1', name: 'Frattina Exclusive Apartment', avg_cleaning_hours: 2 },
      status: 'in_progress',
      checkin_at: '2026-08-21T13:00:00Z',
      real_guests: 4,
      double_beds: 2,
    })

    const openOrder = order({
      id: 'o-2',
      order_number: 1263,
      property: { id: 'p-2', name: 'Colosseo View Luxury', avg_cleaning_hours: 3 },
      status: 'open',
      checkin_at: '2026-08-21T09:30:00Z',
      real_guests: 6,
      double_beds: 2,
    })

    const doneOrder = order({
      id: 'o-3',
      order_number: 1260,
      property: { id: 'p-3', name: 'San Trifone Collection', avg_cleaning_hours: 2 },
      status: 'done',
      checkin_at: '2026-08-21T13:00:00Z',
      completed_at: '2026-08-21T11:16:00Z',
      worked_minutes: 159,
      real_guests: 3,
      double_beds: 1,
    })

    const html = buildCheckinReportPdfHtml([inProgressOrder, openOrder, doneOrder], '2026-08-21', true)

    expect(html).toContain('Veda Bene — Report Check-in')
    expect(html).toContain('Data Check-in: 21/08/2026')
    expect(html).toContain('Totale Immobili: 3')
    expect(html).toContain('In corso: 1')
    expect(html).toContain('Aperti: 1')
    expect(html).toContain('Completati: 1')

    // Chronological ordering: Colosseo (09:30 UTC -> 11:30 Rome) before Frattina / San Trifone (13:00 UTC -> 15:00 Rome)
    const colosseoPos = html.indexOf('Colosseo View Luxury')
    const frattinaPos = html.indexOf('Frattina Exclusive Apartment')
    expect(colosseoPos).toBeLessThan(frattinaPos)

    // Status badges
    expect(html).toContain('IN CORSO')
    expect(html).toContain('APERTO')
    expect(html).toContain('COMPLETATO')
    expect(html).toContain('Conclusa: 21/08/2026, 13:16')

    // Worked time should NEVER appear for cliente
    expect(html).not.toContain('Tempo:')
    expect(html).not.toContain('1h 46min')
    expect(html).not.toContain('2h 39min')

    // Totals
    expect(html).toContain('<h2>Totali occupazione</h2>')
    expect(html).toContain('<td class="highlight">13</td>') // 4 + 6 + 3 = 13 guests
    expect(html).toContain('<td class="highlight">5</td>') // 2 + 2 + 1 = 5 double beds
  })
})
