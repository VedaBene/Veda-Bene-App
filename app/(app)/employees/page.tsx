import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { EmployeeList } from '@/components/employees/EmployeeList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
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
    <div className="animate-fade-in-up">
      <PageHeader
        title="Funcionários"
        action={
          role === 'admin' ? (
            <Link href="/employees/new">
              <Button variant="accent" icon={<Plus size={16} />}>Novo Funcionário</Button>
            </Link>
          ) : undefined
        }
      />

      <EmployeeList employees={(employees ?? []) as Profile[]} role={role} />
    </div>
  )
}
