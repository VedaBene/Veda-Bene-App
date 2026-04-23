import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { toServiceOrderListItem } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'

export default async function ServiceOrdersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  const { data: orders } = await supabase
    .from('service_orders')
    .select(`
      id,
      cleaning_staff_id,
      consegna_staff_id,
      cleaning_date,
      checkout_at,
      checkin_at,
      status,
      real_guests,
      double_beds,
      single_beds,
      sofa_beds,
      armchair_beds,
      bathrooms,
      bidets,
      cribs,
      order_number,
      is_urgent,
      started_at,
      worked_minutes,
      pricing_mode,
      property:properties(id, name, avg_cleaning_hours),
      cleaning_staff:profiles!cleaning_staff_id(id, full_name),
      consegna_staff:profiles!consegna_staff_id(id, full_name)
    `)
    .order('cleaning_date', { ascending: false })

  const all = ((orders ?? []) as ServiceOrderListItem[]).map(order =>
    toServiceOrderListItem(order, role),
  )
  const active = all.filter(o => o.status !== 'done')
  const done = all.filter(o => o.status === 'done')

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Ordens de Serviço"
        action={
          ['admin', 'secretaria'].includes(role) ? (
            <Link href="/service-orders/new">
              <Button variant="accent" icon={<Plus size={16} />}>Nova OS</Button>
            </Link>
          ) : undefined
        }
      />

      <ServiceOrderList active={active} done={done} role={role} userId={user!.id} />
    </div>
  )
}
