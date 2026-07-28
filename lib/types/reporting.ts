import type { PricingMode } from '@/lib/types/database'

export type PayableRow = {
  employee_id: string
  full_name: string
  os_count: number
  total_hours: number
  hourly_rate: number | null
  monthly_salary: number | null
  total_amount: number | null
}

export type EmployeeOption = {
  id: string
  full_name: string
}

export type ClientOption = {
  id: string
  name: string
}

export type ReceivableOrderRow = {
  section: PricingMode
  orderId: string
  orderNumber: number
  cleaningDate: string
  propertyName: string
  clientName: string
  occupancy: {
    guests: number | null
    doubleBeds: number
    singleBeds: number
    sofaBeds: number
    bathrooms: number
    bidets: number
    cribs: number
  }
  currentBasePrice: number | null
  consideredAmount: number
  extraDescription: string | null
  extraAmount: number
  consegnaFee: number
  totalPrice: number
}

export type ReceivableSection = {
  mode: PricingMode
  rows: ReceivableOrderRow[]
  orderCount: number
  consideredTotal: number
  extraTotal: number
  consegnaTotal: number
  sectionTotal: number
}

export type ReceivableReport = {
  period: {
    startDate: string
    endDate: string
  }
  standard: ReceivableSection
  ripasso: ReceivableSection
  outLongStay: ReceivableSection
  grandTotal: number
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
