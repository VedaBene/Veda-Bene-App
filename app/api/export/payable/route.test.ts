import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  role: 'admin',
  getPayableDetailRows: vi.fn(),
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

vi.mock('@/lib/server/reporting/financial', () => ({
  getPayableDetailRows: mocks.getPayableDetailRows,
}))

function request() {
  return new NextRequest('http://localhost:3000/api/export/payable?start=2026-08-01&end=2026-08-05')
}

describe('GET /api/export/payable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'user-1' }
    mocks.role = 'admin'
    mocks.getPayableDetailRows.mockResolvedValue([
      {
        employee_id: 'employee-1',
        employee_name: 'Allen',
        order_id: 'order-834',
        order_number: 834,
        completed_at: '2026-08-01T10:00:00.000Z',
        property_name: 'Aurelia Sunset Penthouse',
        hours: 3,
        hourly_rate: 12.5,
        monthly_salary: null,
        os_total: 37.5,
      },
    ])
  })

  it('rejects unauthenticated callers', async () => {
    mocks.user = null

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.getPayableDetailRows).not.toHaveBeenCalled()
  })

  it('rejects non-admin callers', async () => {
    mocks.role = 'secretaria'

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(mocks.getPayableDetailRows).not.toHaveBeenCalled()
  })

  it('returns the canonical per-order detail in Italian', async () => {
    const response = await GET(request())
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain(
      'estratto-da-pagare_2026-08-01_2026-08-05.csv',
    )
    expect(body).toContain('Dipendente,Data O.L.,Numero O.L.,Immobile/i')
    expect(body).toContain('Allen,01/08/2026,834,Aurelia Sunset Penthouse,3.00,12.50,37.50')
    expect(mocks.getPayableDetailRows).toHaveBeenCalledOnce()
  })
})
