import 'server-only'

import { z } from 'zod'
import type { ClientType, OSStatus, PricingMode, Role } from '@/lib/types/database'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DATE_RANGE_DAYS = 366
const MAX_PAGE = 1000
const MAX_PAGE_SIZE = 100
const MAX_SEARCH_LENGTH = 100
const MAX_NOTES_LENGTH = 2000

type SearchParamsRecord = Record<string, string | string[] | undefined>

function firstSearchParam(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

function emptyToUndefined(value: unknown): unknown {
  const first = firstSearchParam(value)
  if (typeof first !== 'string') return first
  const trimmed = first.trim()
  return trimmed === '' || trimmed === 'all' ? undefined : trimmed
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function dateToTime(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function addDateRangeIssues(
  startDate: string,
  endDate: string,
  ctx: z.RefinementCtx,
) {
  const startTime = dateToTime(startDate)
  const endTime = dateToTime(endDate)

  if (endTime < startTime) {
    ctx.addIssue({
      code: 'custom',
      message: 'Período inválido',
      path: ['endDate'],
    })
    return
  }

  if ((endTime - startTime) / DAY_MS > MAX_DATE_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      message: 'Período máximo de 366 dias',
      path: ['endDate'],
    })
  }
}

export const uuidSchema = z.string().uuid('ID inválido')

export const optionalUuidSchema = z.preprocess(
  emptyToUndefined,
  uuidSchema.optional(),
)

export const dateOnlySchema = z
  .string()
  .refine(isValidDateOnly, 'Data inválida')

export const optionalDateOnlySchema = z.preprocess(
  emptyToUndefined,
  dateOnlySchema.optional(),
)

export const clientTypeSchema = z.enum(['rental', 'particular']) satisfies z.ZodType<ClientType>
export const statementClientTypeSchema = z.enum(['rental', 'particular', 'all'])
export const roleSchema = z.enum(['admin', 'secretaria', 'limpeza', 'consegna', 'cliente']) satisfies z.ZodType<Role>
export const employeeRoleSchema = z.enum(['admin', 'secretaria', 'limpeza', 'consegna'])
export const osStatusSchema = z.enum(['open', 'in_progress', 'done']) satisfies z.ZodType<OSStatus>
export const pricingModeSchema = z.enum(['standard', 'ripasso', 'out_long_stay']) satisfies z.ZodType<PricingMode>

export const optionalSearchSchema = z.preprocess(
  emptyToUndefined,
  z.string().max(MAX_SEARCH_LENGTH, 'Filtro muito longo').optional(),
)

export const optionalNotesSchema = z.preprocess(
  value => (typeof value === 'string' ? value : ''),
  z.string().max(MAX_NOTES_LENGTH, 'Texto muito longo'),
)

export const nonNegativeMoneySchema = z.preprocess(
  value => Number(value),
  z.number().finite('Valor inválido').min(0, 'Valor inválido'),
)

const pageNumberSchema = z.preprocess(
  value => {
    const first = firstSearchParam(value)
    if (first == null || first === '') return 1
    return Number(first)
  },
  z.number().int().min(1).max(MAX_PAGE).default(1),
)

export const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)

export const idParamSchema = z.object({
  id: uuidSchema,
})

export const propertyListSearchParamsSchema = z.object({
  page: pageNumberSchema,
  q: optionalSearchSchema,
})

export const serviceOrderListSearchParamsSchema = z.object({
  donePage: pageNumberSchema,
  q: optionalSearchSchema,
  propertyId: optionalUuidSchema,
  cleaningStaffId: optionalUuidSchema,
  consegnaStaffId: optionalUuidSchema,
  startDate: optionalDateOnlySchema,
  endDate: optionalDateOnlySchema,
})

const dateRangeSchema = z
  .object({
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
  })
  .superRefine(({ startDate, endDate }, ctx) => addDateRangeIssues(startDate, endDate, ctx))

export const payableStatementFiltersSchema = dateRangeSchema.extend({
  employeeId: optionalUuidSchema,
})

export const receivableStatementFiltersSchema = dateRangeSchema.extend({
  clientType: z.preprocess(
    emptyToUndefined,
    statementClientTypeSchema.optional(),
  ),
  clientId: optionalUuidSchema,
})

export const payableExportSearchParamsSchema = z.object({
  start: z.preprocess(firstSearchParam, dateOnlySchema),
  end: z.preprocess(firstSearchParam, dateOnlySchema),
  employee_id: optionalUuidSchema,
}).transform(({ start, end, employee_id }) => ({
  startDate: start,
  endDate: end,
  employeeId: employee_id,
}))
  .superRefine(({ startDate, endDate }, ctx) => addDateRangeIssues(startDate, endDate, ctx))

export const receivableExportSearchParamsSchema = z.object({
  start: z.preprocess(firstSearchParam, dateOnlySchema),
  end: z.preprocess(firstSearchParam, dateOnlySchema),
  client_type: z.preprocess(emptyToUndefined, clientTypeSchema.optional()),
  client_id: optionalUuidSchema,
}).transform(({ start, end, client_type, client_id }) => ({
  startDate: start,
  endDate: end,
  clientType: client_type,
  clientId: client_id,
}))
  .superRefine(({ startDate, endDate }, ctx) => addDateRangeIssues(startDate, endDate, ctx))

export type PropertyListFilters = z.infer<typeof propertyListSearchParamsSchema> & {
  pageSize: number
}

export type ServiceOrderListFilters = z.infer<typeof serviceOrderListSearchParamsSchema> & {
  donePageSize: number
}

export type PayableStatementFilters = z.infer<typeof payableStatementFiltersSchema>
export type ReceivableStatementFilters = z.infer<typeof receivableStatementFiltersSchema>

export function searchParamsToRecord(searchParams: URLSearchParams): SearchParamsRecord {
  const record: SearchParamsRecord = {}
  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key)
    record[key] = values.length > 1 ? values : values[0]
  }
  return record
}

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Parâmetros inválidos'
}
