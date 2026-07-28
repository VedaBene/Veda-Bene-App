import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  role: 'admin',
  getReceivableReport: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mocks.user } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { role: mocks.role }, error: null })),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/server/reporting/receivable', () => ({
  getReceivableReport: mocks.getReceivableReport,
}))

function request() {
  return new NextRequest('http://localhost:3000/api/export/receivable?start=2026-05-01&end=2026-05-31')
}

const emptyReport = {
  period: { startDate: '2026-05-01', endDate: '2026-05-31' },
  standard: { mode: 'standard', rows: [], orderCount: 0, completeOrderCount: 0, pendingCount: 0, consideredTotal: 0, extraTotal: 0, consegnaTotal: 0, sectionTotal: 0 },
  ripasso: { mode: 'ripasso', rows: [], orderCount: 0, completeOrderCount: 0, pendingCount: 0, consideredTotal: 0, extraTotal: 0, consegnaTotal: 0, sectionTotal: 0 },
  outLongStay: { mode: 'out_long_stay', rows: [], orderCount: 0, completeOrderCount: 0, pendingCount: 0, consideredTotal: 0, extraTotal: 0, consegnaTotal: 0, sectionTotal: 0 },
  orderCount: 0,
  completeOrderCount: 0,
  pendingCount: 0,
  grandTotal: 0,
}

describe('GET /api/export/receivable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'user-1' }
    mocks.role = 'admin'
    mocks.getReceivableReport.mockResolvedValue(emptyReport)
  })

  it('rejects unauthenticated callers', async () => {
    mocks.user = null

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.getReceivableReport).not.toHaveBeenCalled()
  })

  it('rejects secretaria even when the route URL is called directly', async () => {
    mocks.role = 'secretaria'

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(mocks.getReceivableReport).not.toHaveBeenCalled()
  })

  it('returns the detailed CSV only to admin', async () => {
    const response = await GET(request())
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toContain('Sezione,Data,Numero OS')
    expect(mocks.getReceivableReport).toHaveBeenCalledOnce()
  })

  it('blocks CSV export when the filtered report has financial pendencies', async () => {
    mocks.getReceivableReport.mockResolvedValue({
      ...emptyReport,
      orderCount: 1,
      pendingCount: 1,
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toEqual({
      error: 'Exportação bloqueada: existem 1 O.S. com dados financeiros pendentes neste filtro.',
      pendingCount: 1,
    })
  })
})
