import 'server-only'

import { getDashboardReportingData } from '@/lib/server/reporting/financial'
import type { DashboardData } from '@/lib/types/dashboard'
export async function getDashboardData(): Promise<DashboardData> {
  return getDashboardReportingData()
}
