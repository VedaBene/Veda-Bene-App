import { notFound, redirect } from 'next/navigation'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteEmployee } from '../actions'
import { canManageEmployees } from '@/lib/employee-permissions'
import { toEmployeeFormData } from '@/lib/server/view-models'
import { idParamSchema } from '@/lib/server/validation/contracts'
import type { EmployeeFormData } from '@/lib/types/view-models'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { loadEmployeeDetailForAdministration } from '@/lib/server/data-access/sensitive-data'

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const parsedParams = idParamSchema.safeParse(await params)
  if (!parsedParams.success) notFound()

  const { id } = parsedParams.data
  const { viewer } = await getCurrentViewer()
  const role = viewer.role

  if (!canManageEmployees(role)) redirect('/service-orders')

  const rawEmployee = await loadEmployeeDetailForAdministration(id)

  if (!rawEmployee) notFound()

  const employee = rawEmployee as EmployeeFormData

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
