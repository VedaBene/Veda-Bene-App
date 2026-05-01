import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteServiceOrder } from '../actions'
import { toServiceOrderFormData } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type {
  ServiceOrderFormData,
  ServiceOrderPropertyOption,
  StaffOption,
} from '@/lib/types/view-models'

export default async function ServiceOrderDetailPage({
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
  const isAdminOrSec = ['admin', 'secretaria'].includes(role)
  const orderSelect = [
    'id',
    'property_id',
    'cleaning_staff_id',
    'consegna_staff_id',
    'cleaning_date',
    'checkout_at',
    'checkin_at',
    'status',
    'real_guests',
    'double_beds',
    'single_beds',
    'sofa_beds',
    'armchair_beds',
    'bathrooms',
    'bidets',
    'cribs',
    'order_number',
    'is_urgent',
    'started_at',
    'completed_at',
    'completion_notes',
    'worked_minutes',
    'pricing_mode',
    ...(isAdminOrSec
      ? ['cleaning_notes', 'extra_services_description', 'extra_services_price']
      : []),
  ].join(', ')

  const propertiesQuery = role === 'admin'
    ? supabase
        .from('properties')
        .select('id, name, avg_cleaning_hours, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs, base_price')
        .order('name')
    : isAdminOrSec
      ? supabase
          .from('properties')
          .select('id, name, avg_cleaning_hours, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs')
          .order('name')
      : role === 'cliente'
      ? supabase
          .from('properties')
          .select('id, name, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs')
          .order('name')
      : supabase
          .from('properties')
          .select('id, name, avg_cleaning_hours, min_guests, max_guests, double_beds, single_beds, sofa_beds, armchair_beds, bathrooms, bidets, cribs')
          .order('name')

  const [{ data: order }, { data: properties }, { data: staffData }] = await Promise.all([
    supabase
      .from('service_orders')
      .select(orderSelect)
      .eq('id', id)
      .single(),
    propertiesQuery,
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
      <PageHeader title="Ordine di Lavoro" />
      <ServiceOrderForm
        order={toServiceOrderFormData(order as unknown as ServiceOrderFormData, role, user.id)}
        properties={(properties ?? []) as ServiceOrderPropertyOption[]}
        staff={(staffData ?? []) as StaffOption[]}
        role={role}
        userId={user.id}
        deleteAction={['admin', 'secretaria'].includes(role) ? deleteServiceOrder.bind(null, id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
