import { describe, expect, it } from 'vitest'
import type { ServiceOrderListItem } from '@/lib/types/view-models'
import { buildServiceOrdersPdfHtml } from './ServiceOrderActiveExport'

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
})
