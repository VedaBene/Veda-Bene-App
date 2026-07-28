import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAgencies,
  fetchOwners,
  fetchReceivableReport,
} from './actions'

const mocks = vi.hoisted(() => ({
  getAuthorizedClient: vi.fn(),
  getReceivableReport: vi.fn(),
  getReportingAgencies: vi.fn(),
  getReportingOwners: vi.fn(),
}))

vi.mock('@/lib/server/authz', () => ({
  getAuthorizedClient: mocks.getAuthorizedClient,
}))

vi.mock('@/lib/server/reporting/receivable', () => ({
  getReceivableReport: mocks.getReceivableReport,
}))

vi.mock('@/lib/server/reporting/financial', () => ({
  getPayableDetailRows: vi.fn(),
  getPayableStatementRows: vi.fn(),
  getReportingEmployees: vi.fn(),
  getReportingAgencies: mocks.getReportingAgencies,
  getReportingOwners: mocks.getReportingOwners,
}))

describe('receivable statement server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthorizedClient.mockResolvedValue({ supabase: { id: 'server-client' } })
    mocks.getReceivableReport.mockResolvedValue({ grandTotal: 0 })
    mocks.getReportingAgencies.mockResolvedValue([])
    mocks.getReportingOwners.mockResolvedValue([])
  })

  it('requires admin for the canonical report action used by screen and PDF', async () => {
    await fetchReceivableReport('2026-05-01', '2026-05-31')

    expect(mocks.getAuthorizedClient).toHaveBeenCalledWith(['admin'])
    expect(mocks.getReceivableReport).toHaveBeenCalledOnce()
  })

  it('requires admin before returning agency and owner filter options', async () => {
    await fetchAgencies()
    await fetchOwners()

    expect(mocks.getAuthorizedClient).toHaveBeenNthCalledWith(1, ['admin'])
    expect(mocks.getAuthorizedClient).toHaveBeenNthCalledWith(2, ['admin'])
  })

  it('propagates an authorization denial instead of returning financial data', async () => {
    mocks.getAuthorizedClient.mockRejectedValue(new Error('Sem permissão'))

    await expect(fetchReceivableReport('2026-05-01', '2026-05-31'))
      .rejects.toThrow('Sem permissão')
    expect(mocks.getReceivableReport).not.toHaveBeenCalled()
  })
})
