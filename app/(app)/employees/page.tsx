import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { EmployeeList } from '@/components/employees/EmployeeList'
import type { Profile, Role } from '@/lib/types/database'

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!['admin', 'secretaria'].includes(role)) redirect('/dashboard')

  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'secretaria', 'limpeza', 'consegna'])
    .order('full_name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Funcionários</h1>
        {role === 'admin' && (
          <Link
            href="/employees/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Novo Funcionário
          </Link>
        )}
      </div>

      <EmployeeList employees={(employees ?? []) as Profile[]} role={role} />
    </div>
  )
}
