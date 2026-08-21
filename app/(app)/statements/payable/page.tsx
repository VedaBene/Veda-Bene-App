import { redirect } from 'next/navigation'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { PayableStatement } from '@/components/statements/PayableStatement'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchPayableData, fetchEmployees } from '../actions'
import { getRomeDateOnly, getRomeMonthStartDateOnly } from '@/lib/utils/date-rome'

export default async function PayablePage() {
  const { viewer } = await getCurrentViewer()

  if (viewer.role !== 'admin') redirect('/service-orders')

  const now = new Date()
  const startDate = getRomeMonthStartDateOnly(now)
  const endDate = getRomeDateOnly(now)

  const [initial, employees] = await Promise.all([
    fetchPayableData(startDate, endDate),
    fetchEmployees(),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Extrato a Pagar" description="Resumo de pagamentos a funcionários no período selecionado" />
      <PayableStatement
        initial={initial}
        initialStartDate={startDate}
        initialEndDate={endDate}
        employees={employees}
      />
    </div>
  )
}
