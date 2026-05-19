import type { ClientType } from '@/lib/types/database'

export type PayableRow = {
  employee_id: string
  full_name: string
  os_count: number
  total_hours: number
  hourly_rate: number | null
  monthly_salary: number | null
  total_amount: number | null
}

export type ReceivableRow = {
  property_id: string
  property_name: string
  client_type: ClientType
  client_name: string
  os_count: number
  total_value: number
}

export type EmployeeOption = {
  id: string
  full_name: string
}

export type ClientOption = {
  id: string
  name: string
}

export type ReceivableDetailRow = {
  order_id: string
  order_number: number
  completed_at: string | null
  property_name: string
  client_type: ClientType
  client_name: string
  real_guests: number | null
  extra_services_price: number | null
  total_price: number
}

export type PayableDetailRow = {
  employee_id: string
  employee_name: string
  order_id: string
  order_number: number
  completed_at: string | null
  property_name: string
  hours: number
  hourly_rate: number | null
  monthly_salary: number | null
  os_total: number | null
}
