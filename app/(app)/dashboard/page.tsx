import { fetchDashboardData } from './actions'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TopPropertiesTable } from '@/components/dashboard/TopPropertiesTable'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { StaffCostChart } from '@/components/dashboard/StaffCostChart'
import { PageHeader } from '@/components/ui/PageHeader'
import { DateTimeDisplay } from '@/components/ui/DateTimeDisplay'

export default async function DashboardPage() {
  const { data, role } = await fetchDashboardData()

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="Dashboard" action={<DateTimeDisplay />} />

      <StatsCards
        propertiesThisMonth={data.propertiesThisMonth}
        hoursThisMonth={data.hoursThisMonth}
        revenueThisMonth={data.revenueThisMonth}
        role={role}
      />

      <TopPropertiesTable topMonth={data.topMonth} topYear={data.topYear} />

      {role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <RevenueChart data={data.revenueByMonth} />
          <StaffCostChart data={data.staffCostByMonth} />
        </div>
      )}
    </div>
  )
}
