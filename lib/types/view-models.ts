import type {
  PricingMode,
  Profile,
  Property,
  ServiceOrder,
} from './database'

export type EmployeeFormData = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'phone' | 'birth_date' | 'nationality' | 'address' | 'role'
> &
  Partial<Pick<Profile, 'hourly_rate' | 'monthly_salary' | 'overtime_rate'>>

export type EmployeeListItem = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'phone' | 'birth_date' | 'nationality' | 'role'
> &
  Partial<Pick<Profile, 'hourly_rate' | 'monthly_salary' | 'overtime_rate'>>

export type PropertyListItem = {
  id: string
  name: string
  zone: Property['zone']
  address?: string | null
  client_type?: Property['client_type']
  base_price?: number | null
}

export type PropertyFormData = {
  id: string
  name: string
  client_type?: Property['client_type']
  agency_id?: string | null
  owner_id?: string | null
  zone: Property['zone']
  phone?: string | null
  address?: string | null
  zip_code?: string | null
  sqm_interior?: number | null
  sqm_exterior?: number | null
  sqm_total?: number | null
  min_guests?: number | null
  max_guests?: number | null
  double_beds: number
  single_beds: number
  sofa_beds: number
  armchair_beds: number
  bathrooms: number
  bidets: number
  cribs: number
  bedrooms?: number | null
  base_price?: number | null
  extra_per_person?: number | null
  avg_cleaning_hours?: number | null
  notes?: string | null
}

export type StaffOption = Pick<Profile, 'id' | 'full_name'>

export type ServiceOrderPropertyOption = Pick<
  Property,
  | 'id'
  | 'name'
  | 'avg_cleaning_hours'
  | 'min_guests'
  | 'max_guests'
  | 'double_beds'
  | 'single_beds'
  | 'sofa_beds'
  | 'armchair_beds'
  | 'bathrooms'
  | 'bidets'
  | 'cribs'
> & {
  base_price?: number | null
}

export type ServiceOrderListItem = Pick<
  ServiceOrder,
  | 'id'
  | 'cleaning_staff_id'
  | 'consegna_staff_id'
  | 'cleaning_date'
  | 'checkout_at'
  | 'checkin_at'
  | 'status'
  | 'real_guests'
  | 'double_beds'
  | 'single_beds'
  | 'sofa_beds'
  | 'armchair_beds'
  | 'bathrooms'
  | 'bidets'
  | 'cribs'
  | 'order_number'
  | 'is_urgent'
  | 'started_at'
  | 'worked_minutes'
  | 'pricing_mode'
> & {
  property: Pick<Property, 'id' | 'name' | 'avg_cleaning_hours'> | null
  cleaning_staff: StaffOption | null
  consegna_staff: StaffOption | null
}

export type ServiceOrderFormData = Pick<
  ServiceOrder,
  | 'id'
  | 'property_id'
  | 'cleaning_staff_id'
  | 'consegna_staff_id'
  | 'cleaning_date'
  | 'checkout_at'
  | 'checkin_at'
  | 'status'
  | 'real_guests'
  | 'double_beds'
  | 'single_beds'
  | 'sofa_beds'
  | 'armchair_beds'
  | 'bathrooms'
  | 'bidets'
  | 'cribs'
  | 'order_number'
  | 'is_urgent'
  | 'started_at'
  | 'completed_at'
  | 'worked_minutes'
> & {
  pricing_mode: PricingMode
  completion_notes?: string | null
  cleaning_notes?: string | null
  extra_services_description?: string | null
  extra_services_price?: number | null
}
