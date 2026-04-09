import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import type { Profile, Property, Role, ServiceOrder } from '@/lib/types/database'

type OSWithRelations = ServiceOrder & {
  property: Pick<Property, 'id' | 'name'> | null
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
      property:properties(id, name),
      cleaning_staff:profiles!cleaning_staff_id(id, full_name),
      consegna_staff:profiles!consegna_staff_id(id, full_name)
    `)
    .order('cleaning_date', { ascending: false })

  const all = (orders ?? []) as OSWithRelations[]
  const active = all.filter(o => o.status !== 'done')
  const done = all.filter(o => o.status === 'done')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
        {['admin', 'secretaria'].includes(role) && (
          <Link
            href="/service-orders/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Nova OS
          </Link>
        )}
      </div>

      <ServiceOrderList active={active} done={done} role={role} />
    </div>
  )
}
