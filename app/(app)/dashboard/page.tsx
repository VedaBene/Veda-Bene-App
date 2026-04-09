import { fetchDashboardData } from './actions'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TopPropertiesTable } from '@/components/dashboard/TopPropertiesTable'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { StaffCostChart } from '@/components/dashboard/StaffCostChart'

export default async function DashboardPage() {
  const { data, role } = await fetchDashboardData()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <StatsCards
        propertiesThisMonth={data.propertiesThisMonth}
        hoursThisMonth={data.hoursThisMonth}
        revenueThisMonth={data.revenueThisMonth}
        role={role}
      />

      <TopPropertiesTable topMonth={data.topMonth} topYear={data.topYear} />

      {role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={data.revenueByMonth} />
          <StaffCostChart data={data.staffCostByMonth} />
        </div>
      )}
    </div>
  )
}
