import { redirect } from 'next/navigation'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { canManageEmployees } from '@/lib/employee-permissions'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'

export default async function NewEmployeePage() {
  const { viewer } = await getCurrentViewer()
  const role = viewer.role

  if (!canManageEmployees(role)) redirect('/service-orders')

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Novo Funcionário" />
      <EmployeeForm viewerRole={role} />
    </div>
  )
}
