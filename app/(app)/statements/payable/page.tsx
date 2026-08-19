import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PayableStatement } from '@/components/statements/PayableStatement'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchPayableData, fetchEmployees } from '../actions'
import type { Role } from '@/lib/types/database'
import { getRomeDateOnly, getRomeMonthStartDateOnly } from '@/lib/utils/date-rome'

export default async function PayablePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (role !== 'admin') redirect('/service-orders')

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
