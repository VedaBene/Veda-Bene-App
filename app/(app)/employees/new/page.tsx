import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import type { Role } from '@/lib/types/database'

export default async function NewEmployeePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!['admin', 'secretaria'].includes(role)) redirect('/employees')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Funcionário</h1>
      <EmployeeForm viewerRole={role} />
    </div>
  )
}
