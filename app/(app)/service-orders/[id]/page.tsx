import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteServiceOrder } from '../actions'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

export default async function ServiceOrderDetailPage({
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

  const [{ data: order }, { data: properties }, { data: staffData }] = await Promise.all([
    supabase
      .from('service_orders')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('properties')
      .select('id, name, avg_cleaning_hours, min_guests, max_guests, double_beds, single_beds, sofa_beds, bathrooms, bidets, cribs')
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['limpeza', 'consegna'])
      .order('full_name'),
  ])

  if (!order) notFound()

  const canEdit = ['admin', 'secretaria'].includes(role)

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Ordem de Serviço" />
      <ServiceOrderForm
        order={order as ServiceOrder}
        properties={(properties ?? []) as Pick<Property, 'id' | 'name' | 'avg_cleaning_hours' | 'min_guests' | 'max_guests' | 'double_beds' | 'single_beds' | 'sofa_beds' | 'bathrooms' | 'bidets' | 'cribs'>[]}
        staff={(staffData ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
        role={role}
        userId={user!.id}
        deleteAction={['admin', 'secretaria'].includes(role) ? deleteServiceOrder.bind(null, id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
