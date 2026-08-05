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
  it('places Consegna before occupancy and Pulizia after occupancy', () => {
    const html = buildServiceOrdersPdfHtml([order()], '2026-08-05', 'open')

    const consegnaHeader = html.indexOf('<th class="staff-header">Consegna</th>')
    const firstOccupancyHeader = html.indexOf('<th>PX</th>')
    const lastOccupancyHeader = html.indexOf('<th>Culle</th>')
    const cleaningHeader = html.indexOf('<th class="staff-header">Pulizia</th>')
    const notesHeader = html.indexOf('<th class="notes-header">Note Pulizia</th>')

    expect(consegnaHeader).toBeGreaterThan(-1)
    expect(consegnaHeader).toBeLessThan(firstOccupancyHeader)
    expect(cleaningHeader).toBeGreaterThan(lastOccupancyHeader)
    expect(cleaningHeader).toBeLessThan(notesHeader)
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
  })

  it('omits both staff columns when names are unavailable or redacted', () => {
    const html = buildServiceOrdersPdfHtml([
      order({ cleaning_staff: [], consegna_staff: null }),
    ], '2026-08-05', 'open')

    expect(html).not.toContain('<th class="staff-header">Consegna</th>')
    expect(html).not.toContain('<th class="staff-header">Pulizia</th>')
  })
})
