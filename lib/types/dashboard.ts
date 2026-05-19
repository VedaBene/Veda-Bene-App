export type TopProperty = {
  property_id: string
  property_name: string
  os_count: number
}

export type MonthStat = {
  month: string
  label: string
  value: number
}

export type DashboardData = {
  propertiesThisMonth: number
  hoursThisMonth: number
  revenueThisMonth: number
  topMonth: TopProperty[]
  topYear: TopProperty[]
  revenueByMonth: MonthStat[]
  staffCostByMonth: MonthStat[]
}
