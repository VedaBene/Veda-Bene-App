import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PayableStatement } from '@/components/statements/PayableStatement'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchPayableData, fetchEmployees } from '../actions'
import type { Role } from '@/lib/types/database'

export default async function PayablePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (role !== 'admin') redirect('/dashboard')

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const endDate = now.toISOString().slice(0, 10)

  const [initial, employees] = await Promise.all([
    fetchPayableData(startDate, endDate),
    fetchEmployees(),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Extrato a Pagar" description="Resumo de pagamentos a funcionários no período selecionado" />
      <PayableStatement initial={initial} employees={employees} />
    </div>
  )
}
