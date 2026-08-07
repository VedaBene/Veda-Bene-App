import { describe, expect, it } from 'vitest'
import {
  getCompactRomeDateTimeParts,
  isUrgentCleaningWindow,
} from './display'

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
