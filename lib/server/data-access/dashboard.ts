import 'server-only'

import { getDashboardReportingData } from '@/lib/server/reporting/financial'
import type { DashboardData } from '@/lib/types/dashboard'
import type { SupabaseServerClient } from './viewer'

export async function getDashboardData(supabase: SupabaseServerClient): Promise<DashboardData> {
  return getDashboardReportingData(supabase)
}
