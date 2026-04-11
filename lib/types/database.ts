export type Role = 'admin' | 'secretaria' | 'limpeza' | 'consegna' | 'cliente'
export type ClientType = 'rental' | 'particular'
export type OSStatus = 'open' | 'in_progress' | 'done'
export type Zone =
  | 'Saint Peter'
  | 'Piazza Navona'
  | 'Trastevere Area'
  | 'Colosseum'
  | 'Spanish Steps'
  | 'Trevi Fountain'
  | "Campo de'Fiori"
  | 'Parioli'
  | 'Termini Station'
  | 'Other areas'

export type Profile = {
  id: string
  full_name: string
  email: string
  phone?: string | null
  role: Role
  birth_date?: string | null
  nationality?: string | null
  address?: string | null
  hourly_rate?: number | null
  monthly_salary?: number | null
  overtime_rate?: number | null
  created_at: string
}

export type Agency = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  created_at: string
}

export type Owner = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  created_at: string
}

export type Property = {
  id: string
  name: string
  client_type: ClientType
  agency_id?: string | null
  owner_id?: string | null
  zone: Zone
  phone?: string | null
  email?: string | null
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
  bathrooms: number
  bidets: number
  cribs: number
  base_price?: number | null
  extra_per_person?: number | null
  avg_cleaning_hours?: number | null
  notes?: string | null
  created_at: string
}

export type ServiceOrder = {
  id: string
  property_id: string
  cleaning_staff_id?: string | null
  consegna_staff_id?: string | null
  cleaning_date?: string | null
  checkout_at?: string | null
  checkin_at?: string | null
  status: OSStatus
  real_guests?: number | null
  double_beds: number
  single_beds: number
  sofa_beds: number
  bathrooms: number
  bidets: number
  cribs: number
  total_price?: number | null
  order_number: number
  is_urgent: boolean
  started_at?: string | null
  completed_at?: string | null
  completion_notes?: string | null
  worked_minutes?: number | null
  created_at: string
}

// Tipo para o JWT payload com o app_role injetado pelo hook
export type JwtWithRole = {
  app_role?: Role
  sub?: string
  email?: string
  exp?: number
}
