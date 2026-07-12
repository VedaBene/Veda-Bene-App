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
