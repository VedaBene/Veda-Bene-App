import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ReceivableStatement } from '@/components/statements/ReceivableStatement'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchReceivableData, fetchAgencies, fetchOwners } from '../actions'
import type { Role } from '@/lib/types/database'

export default async function ReceivablePage() {
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
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const endDate = now.toISOString().slice(0, 10)

  const [initial, agencies, owners] = await Promise.all([
    fetchReceivableData(startDate, endDate),
    fetchAgencies(),
    fetchOwners(),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Extrato a Receber" description="Resumo de valores a receber por imóvel no período selecionado" />
      <ReceivableStatement initial={initial} agencies={agencies} owners={owners} />
    </div>
  )
}
