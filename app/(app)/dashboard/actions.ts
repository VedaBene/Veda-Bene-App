'use server'

import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/server/data-access/dashboard'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import type { DashboardData } from '@/lib/types/dashboard'
import type { Role } from '@/lib/types/database'

export async function fetchDashboardData(): Promise<{ data: DashboardData; role: Role }> {
  const { supabase, viewer } = await getCurrentViewer()
  if (viewer.role !== 'admin') redirect('/service-orders')

  return {
    role: viewer.role,
    data: await getDashboardData(supabase),
  }
}
