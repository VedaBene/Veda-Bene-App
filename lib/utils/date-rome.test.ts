import { describe, expect, it } from 'vitest'
import {
  formatInRomeTimezone,
  getRomeDateOnly,
  getRomeMonthKey,
  getRomeMonthPeriods,
  getRomeMonthStartDateOnly,
  getRomeNMonthsAgoStartDateOnly,
  getRomeYearStartDateOnly,
  nextRomeCivilDay,
  romeCivilDateToUtcStart,
  romeDateRangeToUtcInterval,
} from './date-rome'

describe('Rome date and interval helpers (Europe/Rome)', () => {
  describe('romeCivilDateToUtcStart', () => {
    it('converts winter date (CET UTC+1) at midnight to previous day 23:00 UTC', () => {
      expect(romeCivilDateToUtcStart('2026-01-15')).toBe('2026-01-14T23:00:00.000Z')
    })

    it('converts summer date (CEST UTC+2) at midnight to previous day 22:00 UTC', () => {
      expect(romeCivilDateToUtcStart('2026-08-01')).toBe('2026-07-31T22:00:00.000Z')
    })

    it('handles year rollover (January 1st in CET)', () => {
      expect(romeCivilDateToUtcStart('2026-01-01')).toBe('2025-12-31T23:00:00.000Z')
    })

    it('handles leap day (February 29th in CET)', () => {
      expect(romeCivilDateToUtcStart('2024-02-29')).toBe('2024-02-28T23:00:00.000Z')
    })
  })

  describe('nextRomeCivilDay', () => {
    it('advances a normal day within the month', () => {
      expect(nextRomeCivilDay('2026-05-10')).toBe('2026-05-11')
    })

    it('advances from month end to the next month', () => {
      expect(nextRomeCivilDay('2026-08-31')).toBe('2026-09-01')
      expect(nextRomeCivilDay('2026-04-30')).toBe('2026-05-01')
    })

    it('advances across year boundary', () => {
      expect(nextRomeCivilDay('2025-12-31')).toBe('2026-01-01')
    })

    it('handles leap year in February', () => {
      expect(nextRomeCivilDay('2024-02-28')).toBe('2024-02-29')
      expect(nextRomeCivilDay('2024-02-29')).toBe('2024-03-01')
    })

    it('handles non-leap year in February', () => {
      expect(nextRomeCivilDay('2025-02-28')).toBe('2025-03-01')
    })
  })

  describe('romeDateRangeToUtcInterval', () => {
    it('produces an exact 24-hour half-open UTC interval for a single day in summer (CEST)', () => {
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2026-08-01', '2026-08-01')

      expect(startUtc).toBe('2026-07-31T22:00:00.000Z')
      expect(nextDayUtc).toBe('2026-08-01T22:00:00.000Z')

      const durationHours = (new Date(nextDayUtc).getTime() - new Date(startUtc).getTime()) / (1000 * 60 * 60)
      expect(durationHours).toBe(24)
    })

    it('produces an exact 24-hour half-open UTC interval for a single day in winter (CET)', () => {
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2026-01-15', '2026-01-15')

      expect(startUtc).toBe('2026-01-14T23:00:00.000Z')
      expect(nextDayUtc).toBe('2026-01-15T23:00:00.000Z')

      const durationHours = (new Date(nextDayUtc).getTime() - new Date(startUtc).getTime()) / (1000 * 60 * 60)
      expect(durationHours).toBe(24)
    })

    it('fully covers an entire month (August: 31 days)', () => {
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2026-08-01', '2026-08-31')

      expect(startUtc).toBe('2026-07-31T22:00:00.000Z')
      expect(nextDayUtc).toBe('2026-08-31T22:00:00.000Z')

      const durationHours = (new Date(nextDayUtc).getTime() - new Date(startUtc).getTime()) / (1000 * 60 * 60)
      expect(durationHours).toBe(31 * 24)
    })

    it('correctly calculates a 23-hour interval on the Spring DST transition day (CET -> CEST)', () => {
      // March 29, 2026: clocks move from 02:00 to 03:00
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2026-03-29', '2026-03-29')

      expect(startUtc).toBe('2026-03-28T23:00:00.000Z') // 00:00 CET
      expect(nextDayUtc).toBe('2026-03-29T22:00:00.000Z') // 00:00 CEST on March 30th

      const durationHours = (new Date(nextDayUtc).getTime() - new Date(startUtc).getTime()) / (1000 * 60 * 60)
      expect(durationHours).toBe(23)
    })

    it('correctly calculates a 25-hour interval on the Autumn DST transition day (CEST -> CET)', () => {
      // October 25, 2026: clocks move from 03:00 back to 02:00
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2026-10-25', '2026-10-25')

      expect(startUtc).toBe('2026-10-24T22:00:00.000Z') // 00:00 CEST
      expect(nextDayUtc).toBe('2026-10-25T23:00:00.000Z') // 00:00 CET on October 26th

      const durationHours = (new Date(nextDayUtc).getTime() - new Date(startUtc).getTime()) / (1000 * 60 * 60)
      expect(durationHours).toBe(25)
    })

    it('handles intervals spanning across year rollover', () => {
      const { startUtc, nextDayUtc } = romeDateRangeToUtcInterval('2025-12-31', '2026-01-01')

      expect(startUtc).toBe('2025-12-30T23:00:00.000Z')
      expect(nextDayUtc).toBe('2026-01-01T23:00:00.000Z')
    })
  })

  describe('Rome date-only helpers with fixed clock', () => {
    it('uses the Italian calendar day when UTC is still on the previous day in summer', () => {
      const instant = new Date('2026-07-31T22:30:00.000Z') // 00:30 on 2026-08-01 CEST

      expect(getRomeDateOnly(instant)).toBe('2026-08-01')
      expect(getRomeMonthStartDateOnly(instant)).toBe('2026-08-01')
      expect(getRomeYearStartDateOnly(instant)).toBe('2026-01-01')
      expect(getRomeNMonthsAgoStartDateOnly(2, instant)).toBe('2026-06-01')
      expect(getRomeMonthKey(instant)).toBe('2026-08')
    })

    it('uses the Italian calendar day in winter time', () => {
      const instant = new Date('2026-01-31T23:30:00.000Z') // 00:30 on 2026-02-01 CET

      expect(getRomeDateOnly(instant)).toBe('2026-02-01')
      expect(getRomeMonthStartDateOnly(instant)).toBe('2026-02-01')
      expect(getRomeYearStartDateOnly(instant)).toBe('2026-01-01')
      expect(getRomeNMonthsAgoStartDateOnly(2, instant)).toBe('2025-12-01')
      expect(getRomeMonthKey(instant)).toBe('2026-02')
    })

    it('generates the last N month periods with keys and Portuguese labels', () => {
      const instant = new Date('2026-08-15T10:00:00.000Z')
      const periods = getRomeMonthPeriods(3, instant)

      expect(periods).toEqual([
        { key: '2026-06', label: 'jun' },
        { key: '2026-07', label: 'jul' },
        { key: '2026-08', label: 'ago' },
      ])
    })
  })

  describe('formatInRomeTimezone', () => {
    it('formats timestamp in Rome timezone regardless of system timezone', () => {
      const instant = '2026-07-31T22:30:00.000Z'
      const formatted = formatInRomeTimezone(instant, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      expect(formatted).toContain('01/08/2026')
      expect(formatted).toContain('00:30')
    })
  })
})
