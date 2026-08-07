import type { Role } from '@/lib/types/database'
import { getRomeDateOnly } from '@/lib/utils/date-rome'

export type OperationalServiceOrderWindow = {
  today: string
  tomorrow: string
}

export function isOperationalStaffRole(role: Role): role is 'limpeza' | 'consegna' {
  return role === 'limpeza' || role === 'consegna'
}

export function addCalendarDays(dateOnly: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!match) throw new Error('Data de calendário inválida')

  const [, year, month, day] = match
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days))
  const pad = (part: number) => String(part).padStart(2, '0')

  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
}

export function getOperationalServiceOrderWindow(
  now: Date | string | number = new Date(),
): OperationalServiceOrderWindow {
  const today = getRomeDateOnly(now)
  return {
    today,
    tomorrow: addCalendarDays(today, 1),
  }
}
