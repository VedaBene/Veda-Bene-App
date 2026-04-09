import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Profile, Property, Role } from '@/lib/types/database'

export default async function NewServiceOrderPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  if (!['admin', 'secretaria'].includes(role)) redirect('/service-orders')

  const [{ data: properties }, { data: staffData }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, avg_cleaning_hours, min_guests, max_guests')
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['limpeza', 'consegna'])
      .order('full_name'),
  ])

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Nova Ordem de Serviço" />
      <ServiceOrderForm
        properties={(properties ?? []) as Pick<Property, 'id' | 'name' | 'avg_cleaning_hours' | 'min_guests' | 'max_guests'>[]}
        staff={(staffData ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
        role={role}
      />
    </div>
  )
}
