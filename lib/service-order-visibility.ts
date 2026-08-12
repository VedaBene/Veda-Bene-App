import type { Role } from '@/lib/types/database'
import { getRomeDateOnly } from '@/lib/utils/date-rome'

export type OperationalServiceOrderVisibility = {
  today: string
  maxVisibleDate: string
}

export function isOperationalStaffRole(role: Role): role is 'limpeza' | 'consegna' {
  return role === 'limpeza' || role === 'consegna'
}

export function getOperationalServiceOrderVisibility(
  now: Date | string | number = new Date(),
): OperationalServiceOrderVisibility {
  const today = getRomeDateOnly(now)
  return {
    today,
    maxVisibleDate: today,
  }
}
