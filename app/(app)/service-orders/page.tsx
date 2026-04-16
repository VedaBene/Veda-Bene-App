import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type OSWithRelations = ServiceOrder & {
  property: Pick<Property, 'id' | 'name' | 'avg_cleaning_hours'> | null
  cleaning_staff: Pick<Profile, 'id' | 'full_name'> | null
  consegna_staff: Pick<Profile, 'id' | 'full_name'> | null
}

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
      *,
      property:properties(id, name, avg_cleaning_hours),
      cleaning_staff:profiles!cleaning_staff_id(id, full_name),
      consegna_staff:profiles!consegna_staff_id(id, full_name)
    `)
    .order('cleaning_date', { ascending: false })

  const all = (orders ?? []) as OSWithRelations[]
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
