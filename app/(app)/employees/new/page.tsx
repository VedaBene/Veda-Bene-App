import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { canManageEmployees } from '@/lib/employee-permissions'
import type { Role } from '@/lib/types/database'

export default async function NewEmployeePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!canManageEmployees(role)) redirect('/service-orders')

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Novo Funcionário" />
      <EmployeeForm viewerRole={role} />
    </div>
  )
}
