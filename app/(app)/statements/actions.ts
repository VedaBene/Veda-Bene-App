'use server'

import { getAuthorizedClient } from '@/lib/server/authz'
import {
  getPayableDetailRows,
  getPayableStatementRows,
  getReportingAgencies,
  getReportingEmployees,
  getReportingOwners,
} from '@/lib/server/reporting/financial'
import { getReceivableReport } from '@/lib/server/reporting/receivable'
import {
  payableStatementFiltersSchema,
  receivableStatementFiltersSchema,
  validationMessage,
} from '@/lib/server/validation/contracts'
import type {
  ClientOption,
  EmployeeOption,
  PayableDetailRow,
  PayableRow,
  ReceivableReport,
} from '@/lib/types/reporting'

export async function fetchEmployees(): Promise<EmployeeOption[]> {
  const { supabase } = await getAuthorizedClient(['admin'])
  return getReportingEmployees(supabase)
}

export async function fetchPayableData(
  startDate: string,
  endDate: string,
  employeeId?: string,
): Promise<PayableRow[]> {
  const parsedFilters = payableStatementFiltersSchema.safeParse({ startDate, endDate, employeeId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  await getAuthorizedClient(['admin'])
  return getPayableStatementRows(parsedFilters.data)
}

export async function fetchAgencies(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient(['admin'])
  return getReportingAgencies(supabase)
}

export async function fetchOwners(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient(['admin'])
  return getReportingOwners(supabase)
}

export async function fetchReceivableReport(
  startDate: string,
  endDate: string,
  clientType?: 'rental' | 'particular' | 'all',
  clientId?: string,
): Promise<ReceivableReport> {
  const parsedFilters = receivableStatementFiltersSchema.safeParse({ startDate, endDate, clientType, clientId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  await getAuthorizedClient(['admin'])
  return getReceivableReport(parsedFilters.data)
}

export async function fetchPayableDetail(
  startDate: string,
  endDate: string,
  employeeId?: string,
): Promise<PayableDetailRow[]> {
  const parsedFilters = payableStatementFiltersSchema.safeParse({ startDate, endDate, employeeId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  await getAuthorizedClient(['admin'])
  return getPayableDetailRows(parsedFilters.data)
}
