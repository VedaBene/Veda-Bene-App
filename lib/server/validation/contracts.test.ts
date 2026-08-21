import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  addServiceOrderTemporalIssues,
  emailSchema,
  nameSchema,
  optRomeIsoDateTimeSchema,
  optionalAddressSchema,
  optionalEmailSchema,
  optionalNotesSchema,
  optionalPhoneSchema,
  optionalZipCodeSchema,
} from '@/lib/server/validation/contracts'

describe('contracts validation hardening', () => {
  describe('optRomeIsoDateTimeSchema', () => {
    it('accepts undefined, null or empty string as undefined', () => {
      expect(optRomeIsoDateTimeSchema.parse(undefined)).toBeUndefined()
      expect(optRomeIsoDateTimeSchema.parse(null)).toBeUndefined()
      expect(optRomeIsoDateTimeSchema.parse('')).toBeUndefined()
      expect(optRomeIsoDateTimeSchema.parse('   ')).toBeUndefined()
    })

    it('converts valid wall-clock Rome datetime-local into UTC ISO string', () => {
      const parsed = optRomeIsoDateTimeSchema.parse('2026-08-20T14:30')
      expect(typeof parsed).toBe('string')
      expect(parsed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('rejects invalid date strings with validation error instead of silently returning undefined', () => {
      const result1 = optRomeIsoDateTimeSchema.safeParse('not-a-date')
      expect(result1.success).toBe(false)
      if (!result1.success) {
        expect(result1.error.issues[0]?.message).toBe('Data/orario non valido')
      }

      const result2 = optRomeIsoDateTimeSchema.safeParse('2026-99-99T99:99')
      expect(result2.success).toBe(false)
    })
  })

  describe('emailSchema and optionalEmailSchema', () => {
    it('accepts valid normalized email', () => {
      expect(emailSchema.parse('  User@Domain.COM ')).toBe('user@domain.com')
    })

    it('rejects invalid email format', () => {
      expect(emailSchema.safeParse('invalid-email').success).toBe(false)
      expect(emailSchema.safeParse('missing@domain').success).toBe(false)
    })

    it('rejects emails exceeding maximum length of 255 chars', () => {
      const longEmail = `${'a'.repeat(250)}@domain.com`
      expect(emailSchema.safeParse(longEmail).success).toBe(false)
    })

    it('optionalEmailSchema handles empty strings cleanly', () => {
      expect(optionalEmailSchema.parse('')).toBeUndefined()
      expect(optionalEmailSchema.parse('   ')).toBeUndefined()
      expect(optionalEmailSchema.parse(null)).toBeUndefined()
      expect(optionalEmailSchema.parse('Valid@Example.com')).toBe('valid@example.com')
    })
  })

  describe('temporal order constraint (checkin_at >= checkout_at)', () => {
    const testSchema = z
      .object({
        checkout_at: optRomeIsoDateTimeSchema,
        checkin_at: optRomeIsoDateTimeSchema,
      })
      .superRefine(({ checkout_at, checkin_at }, ctx) =>
        addServiceOrderTemporalIssues(checkout_at, checkin_at, ctx),
      )

    it('accepts when checkin is after checkout', () => {
      const valid = testSchema.safeParse({
        checkout_at: '2026-08-20T10:00',
        checkin_at: '2026-08-20T14:00',
      })
      expect(valid.success).toBe(true)
    })

    it('accepts when checkin equals checkout', () => {
      const valid = testSchema.safeParse({
        checkout_at: '2026-08-20T12:00',
        checkin_at: '2026-08-20T12:00',
      })
      expect(valid.success).toBe(true)
    })

    it('accepts when one or both datetimes are omitted', () => {
      expect(testSchema.safeParse({ checkout_at: '2026-08-20T10:00', checkin_at: '' }).success).toBe(true)
      expect(testSchema.safeParse({ checkout_at: '', checkin_at: '2026-08-20T14:00' }).success).toBe(true)
      expect(testSchema.safeParse({ checkout_at: '', checkin_at: '' }).success).toBe(true)
    })

    it('rejects when checkin is before checkout', () => {
      const invalid = testSchema.safeParse({
        checkout_at: '2026-08-20T16:00',
        checkin_at: '2026-08-20T10:00',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe(
          "L'orario di check-in deve essere successivo o uguale al check-out",
        )
      }
    })
  })

  describe('field length constraints', () => {
    it('enforces maximum length on name, phone, address, zip_code and notes', () => {
      expect(nameSchema.safeParse('A'.repeat(256)).success).toBe(false)
      expect(nameSchema.safeParse('Valid Name').success).toBe(true)

      expect(optionalPhoneSchema.safeParse('1'.repeat(51)).success).toBe(false)
      expect(optionalPhoneSchema.safeParse('+39 06 1234567').success).toBe(true)

      expect(optionalAddressSchema.safeParse('Via '.repeat(70)).success).toBe(false)
      expect(optionalAddressSchema.safeParse('Via Roma 123').success).toBe(true)

      expect(optionalZipCodeSchema.safeParse('1'.repeat(21)).success).toBe(false)
      expect(optionalZipCodeSchema.safeParse('00100').success).toBe(true)

      expect(optionalNotesSchema.safeParse('N'.repeat(2001)).success).toBe(false)
      expect(optionalNotesSchema.safeParse('N'.repeat(2000)).success).toBe(true)
    })
  })

  describe('serviceOrderListSearchParamsSchema', () => {
    it('accepts and parses valid checkinDate parameter', async () => {
      const { serviceOrderListSearchParamsSchema } = await import('@/lib/server/validation/contracts')
      const result = serviceOrderListSearchParamsSchema.parse({
        checkinDate: '2026-08-21',
        donePage: '2',
      })
      expect(result.checkinDate).toBe('2026-08-21')
      expect(result.donePage).toBe(2)
    })

    it('handles empty or invalid checkinDate cleanly', async () => {
      const { serviceOrderListSearchParamsSchema } = await import('@/lib/server/validation/contracts')
      const result = serviceOrderListSearchParamsSchema.parse({
        checkinDate: '',
      })
      expect(result.checkinDate).toBeUndefined()

      const invalid = serviceOrderListSearchParamsSchema.safeParse({
        checkinDate: '21/08/2026',
      })
      expect(invalid.success).toBe(false)
    })
  })
})
