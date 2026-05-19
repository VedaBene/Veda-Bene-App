import { describe, expect, it } from 'vitest'
import {
  nonNegativeMoneySchema,
  optionalDateOnlySchema,
  optionalUuidSchema,
  payableExportSearchParamsSchema,
  propertyListSearchParamsSchema,
  receivableExportSearchParamsSchema,
  searchParamsToRecord,
  serviceOrderListSearchParamsSchema,
  uuidSchema,
} from './contracts'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('validation contracts', () => {
  it('accepts UUIDs and rejects malformed IDs', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true)
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
  })

  it('normalizes empty optional UUID and date values', () => {
    expect(optionalUuidSchema.parse('all')).toBeUndefined()
    expect(optionalDateOnlySchema.parse('')).toBeUndefined()
  })

  it('rejects invalid calendar dates', () => {
    expect(optionalDateOnlySchema.safeParse('2026-02-29').success).toBe(false)
    expect(optionalDateOnlySchema.parse('2026-02-28')).toBe('2026-02-28')
  })

  it('defaults list pagination and rejects abusive values', () => {
    expect(propertyListSearchParamsSchema.parse({}).page).toBe(1)
    expect(propertyListSearchParamsSchema.safeParse({ page: '1001' }).success).toBe(false)
    expect(serviceOrderListSearchParamsSchema.parse({ donePage: ['2'], q: ' Roma ' }).donePage).toBe(2)
  })

  it('bounds money values to finite non-negative numbers', () => {
    expect(nonNegativeMoneySchema.parse('12.5')).toBe(12.5)
    expect(nonNegativeMoneySchema.safeParse('-1').success).toBe(false)
    expect(nonNegativeMoneySchema.safeParse('abc').success).toBe(false)
  })

  it('transforms export params and enforces date range rules', () => {
    expect(payableExportSearchParamsSchema.parse({
      start: '2026-01-01',
      end: '2026-01-31',
      employee_id: VALID_UUID,
    })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      employeeId: VALID_UUID,
    })

    expect(payableExportSearchParamsSchema.safeParse({
      start: '2026-02-01',
      end: '2026-01-01',
    }).success).toBe(false)

    expect(receivableExportSearchParamsSchema.parse({
      start: '2026-01-01',
      end: '2026-01-31',
      client_type: 'all',
      client_id: '',
    })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      clientType: undefined,
      clientId: undefined,
    })
  })

  it('converts URLSearchParams into the record shape expected by schemas', () => {
    const params = new URLSearchParams()
    params.append('q', 'roma')
    params.append('page', '2')
    params.append('page', '3')

    expect(searchParamsToRecord(params)).toEqual({
      q: 'roma',
      page: ['2', '3'],
    })
  })
})
