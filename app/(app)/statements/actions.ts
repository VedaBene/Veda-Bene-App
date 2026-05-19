'use server'

import { getAuthorizedClient } from '@/lib/server/authz'
import {
  getPayableDetailRows,
  getPayableStatementRows,
  getReceivableDetailRows,
  getReceivableStatementRows,
  getReportingAgencies,
  getReportingEmployees,
  getReportingOwners,
} from '@/lib/server/reporting/financial'
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
  ReceivableDetailRow,
  ReceivableRow,
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

  const { supabase } = await getAuthorizedClient(['admin'])
  return getPayableStatementRows(supabase, parsedFilters.data)
}

export async function fetchAgencies(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient()
  return getReportingAgencies(supabase)
}

export async function fetchOwners(): Promise<ClientOption[]> {
  const { supabase } = await getAuthorizedClient()
  return getReportingOwners(supabase)
}

export async function fetchReceivableData(
  startDate: string,
  endDate: string,
  clientType?: 'rental' | 'particular' | 'all',
  clientId?: string,
): Promise<ReceivableRow[]> {
  const parsedFilters = receivableStatementFiltersSchema.safeParse({ startDate, endDate, clientType, clientId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  const { supabase } = await getAuthorizedClient()
  return getReceivableStatementRows(supabase, parsedFilters.data)
}

export async function fetchReceivableDetail(
  startDate: string,
  endDate: string,
  clientType?: 'rental' | 'particular' | 'all',
  clientId?: string,
): Promise<ReceivableDetailRow[]> {
  const parsedFilters = receivableStatementFiltersSchema.safeParse({ startDate, endDate, clientType, clientId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  const { supabase } = await getAuthorizedClient()
  return getReceivableDetailRows(supabase, parsedFilters.data)
}

export async function fetchPayableDetail(
  startDate: string,
  endDate: string,
  employeeId?: string,
): Promise<PayableDetailRow[]> {
  const parsedFilters = payableStatementFiltersSchema.safeParse({ startDate, endDate, employeeId })
  if (!parsedFilters.success) throw new Error(validationMessage(parsedFilters.error))

  const { supabase } = await getAuthorizedClient(['admin'])
  return getPayableDetailRows(supabase, parsedFilters.data)
}
