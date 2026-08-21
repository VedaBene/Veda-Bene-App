/**
 * Utilitários para conversão e manipulação de fuso horário centralizado em Europe/Rome.
 */

const ROME_TIMEZONE = 'Europe/Rome'

/**
 * Converte um valor do banco (TIMESTAMPTZ ISO string ex: "2026-07-27T09:00:00.000Z")
 * para a string no formato de parede "YYYY-MM-DDTHH:mm" no fuso Europe/Rome,
 * adequada para ser exibida em um <input type="datetime-local">.
 */
export function toRomeLocalInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  let hour = getPart('hour')
  if (hour === '24') hour = '00'

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${hour}:${getPart('minute')}`
}

/**
 * Converte uma string de hora de parede em Roma ("YYYY-MM-DDTHH:mm") ou ISO para
 * uma string ISO 8601 UTC ("YYYY-MM-DDTHH:mm:ss.sssZ") representando o exato instante em Roma.
 */
export function toRomeIsoString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Se já possui indicador de timezone explícito (Z ou offset +HH:mm/-HH:mm)
  if (/Z|[+-]\d{2}:\d{2}$/i.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Se for uma string datetime-local "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DDTHH:mm:ss"
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const [, yStr, mStr, dStr, hrStr, minStr, secStr] = match
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)
  const hour = parseInt(hrStr, 10)
  const minute = parseInt(minStr, 10)
  const second = secStr ? parseInt(secStr, 10) : 0

  const initialUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const checkDate = new Date(initialUtcMs)
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day ||
    checkDate.getUTCHours() !== hour ||
    checkDate.getUTCMinutes() !== minute ||
    checkDate.getUTCSeconds() !== second
  ) {
    return null
  }

  // Obtém o horário que o instante inicial representa em Europe/Rome
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(new Date(initialUtcMs))
  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  let romeHour = parseInt(getPart('hour'), 10)
  if (romeHour === 24) romeHour = 0

  const romeYear = parseInt(getPart('year'), 10)
  const romeMonth = parseInt(getPart('month'), 10)
  const romeDay = parseInt(getPart('day'), 10)
  const romeMinute = parseInt(getPart('minute'), 10)
  const romeSecond = parseInt(getPart('second'), 10)

  const romeAsUtcMs = Date.UTC(romeYear, romeMonth - 1, romeDay, romeHour, romeMinute, romeSecond)
  const offsetMs = romeAsUtcMs - initialUtcMs

  const exactUtcMs = initialUtcMs - offsetMs
  return new Date(exactUtcMs).toISOString()
}
