import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteEmployee } from '../actions'
import type { Profile, Role } from '@/lib/types/database'

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!['admin', 'secretaria'].includes(role)) redirect('/dashboard')

  const { data: employee } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!employee) notFound()

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={employee.full_name} />
      <EmployeeForm
        employee={employee as Profile}
        viewerRole={role}
        deleteAction={role === 'admin' ? () => deleteEmployee(id) : undefined}
      />
    </div>
  )
}
