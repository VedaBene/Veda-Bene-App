import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteEmployee } from '../actions'
import { canManageEmployees } from '@/lib/employee-permissions'
import { toEmployeeFormData } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { EmployeeFormData } from '@/lib/types/view-models'

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const employeeSelect =
    'id, full_name, email, phone, birth_date, nationality, address, role, hourly_rate, monthly_salary, overtime_rate'

  const { data: rawEmployee } = await supabase
    .from('profiles')
    .select(employeeSelect)
    .eq('id', id)
    .single()

  if (!rawEmployee) notFound()

  const employee = rawEmployee as unknown as EmployeeFormData

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={employee.full_name} />
      <EmployeeForm
        employee={toEmployeeFormData(employee, role)}
        viewerRole={role}
        deleteAction={canManageEmployees(role) ? deleteEmployee.bind(null, id) : undefined}
      />
    </div>
  )
}
