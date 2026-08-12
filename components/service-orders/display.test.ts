import { describe, expect, it } from 'vitest'
import {
  formatStaffName,
  formatStaffNames,
  getCompactRomeDateTimeParts,
  isUrgentCleaningWindow,
} from './display'

describe('service-order staff display helpers', () => {
  it('preserves complete names instead of reducing them to the first token', () => {
    expect(formatStaffName('Henrique 1')).toBe('Henrique 1')
    expect(formatStaffName('João Fonseca')).toBe('João Fonseca')
    expect(formatStaffNames([
      { full_name: 'Andy 04' },
      { full_name: 'Joe 02' },
    ])).toBe('Andy 04, Joe 02')
  })

  it('uses a placeholder when no staff member is assigned', () => {
    expect(formatStaffName(null)).toBe('—')
    expect(formatStaffNames([])).toBe('—')
  })
})

describe('service-order date display helpers', () => {
  it('derives the compact date and complete calendar-day key in Rome', () => {
    expect(getCompactRomeDateTimeParts('2026-08-05T22:30:00Z')).toEqual({
      calendarDate: '06/08',
      calendarDayKey: '2026-08-06',
      time: '00:30',
    })
  })

  it('returns null for missing or invalid timestamps', () => {
    expect(getCompactRomeDateTimeParts(null)).toBeNull()
    expect(getCompactRomeDateTimeParts('not-a-date')).toBeNull()
  })

  it('treats positive windows of exactly three hours as urgent', () => {
    expect(isUrgentCleaningWindow(
      '2026-08-05T08:00:00Z',
      '2026-08-05T11:00:00Z',
    )).toBe(true)
    expect(isUrgentCleaningWindow(
      '2026-08-05T08:00:00Z',
      '2026-08-05T11:01:00Z',
    )).toBe(false)
  })

  it('rejects zero, negative, and invalid cleaning windows', () => {
    expect(isUrgentCleaningWindow(
      '2026-08-05T08:00:00Z',
      '2026-08-05T08:00:00Z',
    )).toBe(false)
    expect(isUrgentCleaningWindow(
      '2026-08-05T09:00:00Z',
      '2026-08-05T08:00:00Z',
    )).toBe(false)
    expect(isUrgentCleaningWindow('invalid', 'invalid')).toBe(false)
  })

  it('calculates wall-clock inputs using the Rome daylight-saving transition', () => {
    expect(isUrgentCleaningWindow(
      '2026-03-29T00:30',
      '2026-03-29T04:00',
    )).toBe(true)
  })
})
