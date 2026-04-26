import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { toServiceOrderListItem } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { ServiceOrderListItem } from '@/lib/types/view-models'

const DONE_PAGE_SIZE = 20

const SERVICE_ORDER_SELECT = `
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
`

export default async function ServiceOrdersPage(props: PageProps<never>) {
  const { donePage: donePageParam, q, date } = await props.searchParams as {
    donePage?: string
    q?: string
    date?: string
  }

  const donePage = Math.max(1, parseInt(donePageParam ?? '1', 10) || 1)
  const doneFrom = (donePage - 1) * DONE_PAGE_SIZE
  const doneTo = doneFrom + DONE_PAGE_SIZE - 1

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  // Active orders — no pagination needed (bounded volume)
  const { data: activeOrders } = await supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT)
    .in('status', ['open', 'in_progress'])
    .order('cleaning_date', { ascending: false })

  // Done orders — paginated, with optional q/date filters
  let propertyIds: string[] | null = null
  if (q) {
    const { data: matchingProps } = await supabase
      .from('properties')
      .select('id')
      .ilike('name', `%${q}%`)
    propertyIds = (matchingProps ?? []).map((p: { id: string }) => p.id)
  }

  let doneQuery = supabase
    .from('service_orders')
    .select(SERVICE_ORDER_SELECT, { count: 'exact' })
    .eq('status', 'done')
    .order('cleaning_date', { ascending: false })
    .range(doneFrom, doneTo)

  if (propertyIds !== null) {
    if (propertyIds.length === 0) {
      // No matching properties — force empty result
      doneQuery = doneQuery.in('property_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      doneQuery = doneQuery.in('property_id', propertyIds)
    }
  }

  if (date) {
    doneQuery = doneQuery.eq('cleaning_date', date)
  }

  const { data: doneOrders, count: doneCount } = await doneQuery

  const doneTotalPages = Math.ceil((doneCount ?? 0) / DONE_PAGE_SIZE)

  const active = ((activeOrders ?? []) as unknown as ServiceOrderListItem[]).map(o =>
    toServiceOrderListItem(o, role),
  )
  const done = ((doneOrders ?? []) as unknown as ServiceOrderListItem[]).map(o =>
    toServiceOrderListItem(o, role),
  )

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

      <ServiceOrderList
        active={active}
        done={done}
        role={role}
        userId={user!.id}
        donePage={donePage}
        doneTotalPages={doneTotalPages}
        initialQ={q ?? ''}
        initialDate={date ?? ''}
      />
    </div>
  )
}
