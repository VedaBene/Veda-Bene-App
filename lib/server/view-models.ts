import 'server-only'

import type { Role } from '@/lib/types/database'
import type {
  EmployeeFormData,
  PropertyFormData,
  PropertyListItem,
  ServiceOrderFormData,
  ServiceOrderListItem,
} from '@/lib/types/view-models'

type RawEmployee = EmployeeFormData

type RawProperty = PropertyFormData

type RawServiceOrderList = ServiceOrderListItem

type RawServiceOrderForm = ServiceOrderFormData

export function toEmployeeFormData(employee: RawEmployee, viewerRole: Role): EmployeeFormData {
  const dto: EmployeeFormData = {
    id: employee.id,
    full_name: employee.full_name,
    email: employee.email,
    phone: employee.phone ?? null,
    birth_date: employee.birth_date ?? null,
    nationality: employee.nationality ?? null,
    address: employee.address ?? null,
    role: employee.role,
  }

  if (viewerRole === 'admin') {
    dto.hourly_rate = employee.hourly_rate ?? null
    dto.monthly_salary = employee.monthly_salary ?? null
    dto.overtime_rate = employee.overtime_rate ?? null
  }

  return dto
}

export function toPropertyListItem(
  property: Pick<PropertyFormData, 'id' | 'name' | 'zone' | 'address' | 'client_type' | 'base_price'>,
  role: Role,
): PropertyListItem {
  return {
    id: property.id,
    name: property.name,
    zone: property.zone,
    address: property.address ?? null,
    ...(role === 'admin' || role === 'secretaria'
      ? {
          client_type: property.client_type,
          base_price: property.base_price ?? null,
        }
      : {}),
  }
}

export function toPropertyFormData(property: RawProperty, role: Role): PropertyFormData {
  const dto: PropertyFormData = {
    id: property.id,
    name: property.name,
    zone: property.zone,
    address: property.address ?? null,
    zip_code: property.zip_code ?? null,
    sqm_interior: property.sqm_interior ?? null,
    sqm_exterior: property.sqm_exterior ?? null,
    sqm_total: property.sqm_total ?? null,
    min_guests: property.min_guests ?? null,
    max_guests: property.max_guests ?? null,
    double_beds: property.double_beds,
    single_beds: property.single_beds,
    sofa_beds: property.sofa_beds,
    armchair_beds: property.armchair_beds,
    bathrooms: property.bathrooms,
    bidets: property.bidets,
    cribs: property.cribs,
    bedrooms: property.bedrooms ?? null,
    notes: property.notes ?? null,
  }

  if (role === 'admin' || role === 'secretaria') {
    dto.client_type = property.client_type
    dto.agency_id = property.agency_id ?? null
    dto.owner_id = property.owner_id ?? null
    dto.phone = property.phone ?? null
  }

  if (role === 'admin') {
    dto.base_price = property.base_price ?? null
    dto.extra_per_person = property.extra_per_person ?? null
    dto.avg_cleaning_hours = property.avg_cleaning_hours ?? null
  }

  return dto
}

export function toServiceOrderListItem(order: RawServiceOrderList, role: Role): ServiceOrderListItem {
  return {
    id: order.id,
    property: order.property,
    cleaning_staff_id: order.cleaning_staff_id ?? null,
    consegna_staff_id: order.consegna_staff_id ?? null,
    cleaning_staff: role === 'cliente' ? null : order.cleaning_staff,
    consegna_staff: role === 'cliente' ? null : order.consegna_staff,
    cleaning_date: order.cleaning_date ?? null,
    checkout_at: order.checkout_at ?? null,
    checkin_at: order.checkin_at ?? null,
    status: order.status,
    real_guests: order.real_guests ?? null,
    double_beds: order.double_beds,
    single_beds: order.single_beds,
    sofa_beds: order.sofa_beds,
    armchair_beds: order.armchair_beds,
    bathrooms: order.bathrooms,
    bidets: order.bidets,
    cribs: order.cribs,
    order_number: order.order_number,
    is_urgent: order.is_urgent,
    started_at: order.started_at ?? null,
    worked_minutes: order.worked_minutes ?? null,
    pricing_mode: order.pricing_mode,
  }
}

export function toServiceOrderFormData(
  order: RawServiceOrderForm,
  role: Role,
  userId?: string,
): ServiceOrderFormData {
  const isAssignedWorker =
    !!userId &&
    ((role === 'limpeza' && order.cleaning_staff_id === userId) ||
      (role === 'consegna' && order.consegna_staff_id === userId))

  const dto: ServiceOrderFormData = {
    id: order.id,
    property_id: order.property_id,
    cleaning_staff_id: order.cleaning_staff_id ?? null,
    consegna_staff_id: order.consegna_staff_id ?? null,
    cleaning_date: order.cleaning_date ?? null,
    checkout_at: order.checkout_at ?? null,
    checkin_at: order.checkin_at ?? null,
    status: order.status,
    real_guests: order.real_guests ?? null,
    double_beds: order.double_beds,
    single_beds: order.single_beds,
    sofa_beds: order.sofa_beds,
    armchair_beds: order.armchair_beds,
    bathrooms: order.bathrooms,
    bidets: order.bidets,
    cribs: order.cribs,
    order_number: order.order_number,
    is_urgent: order.is_urgent,
    started_at: order.started_at ?? null,
    completed_at: order.completed_at ?? null,
    worked_minutes: order.worked_minutes ?? null,
    pricing_mode: order.pricing_mode,
  }

  if (role === 'admin' || role === 'secretaria') {
    dto.cleaning_notes = order.cleaning_notes ?? null
    dto.extra_services_description = order.extra_services_description ?? null
    dto.extra_services_price = order.extra_services_price ?? null
    dto.completion_notes = order.completion_notes ?? null
  } else if (isAssignedWorker) {
    dto.completion_notes = order.completion_notes ?? null
  }

  return dto
}
