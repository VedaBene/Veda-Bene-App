import { redirect } from 'next/navigation'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { ReceivableStatement } from '@/components/statements/ReceivableStatement'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchReceivableReport, fetchAgencies, fetchOwners } from '../actions'
import { getRomeDateOnly, getRomeMonthStartDateOnly } from '@/lib/utils/date-rome'

export default async function ReceivablePage() {
  const { viewer } = await getCurrentViewer()

  if (viewer.role !== 'admin') redirect('/service-orders')

  const now = new Date()
  const startDate = getRomeMonthStartDateOnly(now)
  const endDate = getRomeDateOnly(now)

  const [initial, agencies, owners] = await Promise.all([
    fetchReceivableReport(startDate, endDate),
    fetchAgencies(),
    fetchOwners(),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Extrato a Receber" description="Ordens de serviço e composição dos valores no período selecionado" />
      <ReceivableStatement
        initial={initial}
        initialStartDate={startDate}
        initialEndDate={endDate}
        agencies={agencies}
        owners={owners}
      />
    </div>
  )
}
