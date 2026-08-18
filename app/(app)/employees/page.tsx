import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EmployeeList } from '@/components/employees/EmployeeList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { canManageEmployees } from '@/lib/employee-permissions'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { loadEmployeeListForAdministration } from '@/lib/server/data-access/sensitive-data'

export default async function EmployeesPage() {
  const { viewer } = await getCurrentViewer()
  const role = viewer.role

  if (!canManageEmployees(role)) redirect('/service-orders')

  const employees = await loadEmployeeListForAdministration()

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Funcionários"
        action={
          canManageEmployees(role) ? (
            <Link href="/employees/new">
              <Button variant="accent" icon={<Plus size={16} />}>Novo Funcionário</Button>
            </Link>
          ) : undefined
        }
      />

      <EmployeeList employees={employees} role={role} />
    </div>
  )
}
