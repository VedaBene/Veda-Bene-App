import type { Role } from '@/lib/types/database'

const MANAGEABLE_EMPLOYEE_ROLES: Role[] = ['admin', 'secretaria', 'limpeza', 'consegna']

export function canManageEmployees(role: Role): boolean {
  return role === 'admin'
}

export function getAssignableEmployeeRoles(role: Role): Role[] {
  return canManageEmployees(role) ? MANAGEABLE_EMPLOYEE_ROLES : []
}
