export function formatInRomeTimezone(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale = 'it-IT'
): string {
  try {
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: 'Europe/Rome',
    }).format(d)
  } catch {
    return '—'
  }
}

export function getRomeDateParts(date: Date | string | number): {
  year: string
  month: string
  day: string
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Rome',
  }).formatToParts(new Date(date))

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? ''

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

export function getRomeDateOnly(date: Date | string | number = new Date()): string {
  const { year, month, day } = getRomeDateParts(date)
  return `${year}-${month}-${day}`
}

export function getRomeMonthStartDateOnly(date: Date | string | number = new Date()): string {
  const { year, month } = getRomeDateParts(date)
  return `${year}-${month}-01`
}

export function getRomeYearStartDateOnly(date: Date | string | number = new Date()): string {
  const { year } = getRomeDateParts(date)
  return `${year}-01-01`
}

export function getRomeNMonthsAgoStartDateOnly(
  monthsAgo: number,
  date: Date | string | number = new Date(),
): string {
  const { year, month } = getRomeDateParts(date)
  const yNum = parseInt(year, 10)
  const mNum = parseInt(month, 10)
  const targetDate = new Date(Date.UTC(yNum, mNum - 1 - monthsAgo, 1))
  const y = targetDate.getUTCFullYear()
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function getRomeMonthKey(date: Date | string | number): string {
  const { year, month } = getRomeDateParts(date)
  return `${year}-${month}`
}

export function getRomeMonthPeriods(
  count: number,
  refDate: Date | string | number = new Date(),
): { key: string; label: string }[] {
  const { year, month } = getRomeDateParts(refDate)
  const yNum = parseInt(year, 10)
  const mNum = parseInt(month, 10)

  return Array.from({ length: count }, (_, i) => {
    const targetDate = new Date(Date.UTC(yNum, mNum - (count - i), 1))
    const y = targetDate.getUTCFullYear()
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0')
    const key = `${y}-${m}`
    const label = targetDate.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
    return { key, label }
  })
}

export function romeCivilDateToUtcStart(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  const initialUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0)

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const getParts = (ms: number) => {
    const parts = dtf.formatToParts(new Date(ms))
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
    let h = parseInt(get('hour'), 10)
    if (h === 24) h = 0
    return {
      year: parseInt(get('year'), 10),
      month: parseInt(get('month'), 10),
      day: parseInt(get('day'), 10),
      hour: h,
      minute: parseInt(get('minute'), 10),
      second: parseInt(get('second'), 10),
    }
  }

  const p1 = getParts(initialUtcMs)
  const romeAsUtcMs = Date.UTC(p1.year, p1.month - 1, p1.day, p1.hour, p1.minute, p1.second)
  const offsetMs = romeAsUtcMs - initialUtcMs
  let exactUtcMs = initialUtcMs - offsetMs

  const p2 = getParts(exactUtcMs)
  const p2AsUtcMs = Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute, p2.second)
  const diffMs = p2AsUtcMs - initialUtcMs
  if (diffMs !== 0) {
    exactUtcMs -= diffMs
  }

  return new Date(exactUtcMs).toISOString()
}

export function nextRomeCivilDay(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
  const y = nextDate.getUTCFullYear()
  const m = String(nextDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(nextDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function romeDateRangeToUtcInterval(
  startDate: string,
  endDate: string,
): { startUtc: string; nextDayUtc: string } {
  const startUtc = romeCivilDateToUtcStart(startDate)
  const nextDay = nextRomeCivilDay(endDate)
  const nextDayUtc = romeCivilDateToUtcStart(nextDay)
  return { startUtc, nextDayUtc }
}
