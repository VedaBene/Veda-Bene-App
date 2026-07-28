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

function getRomeDateParts(date: Date | string | number): {
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
