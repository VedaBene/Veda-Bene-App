import Link from 'next/link'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getServiceOrderList } from '@/lib/server/data-access/service-orders'
import { serviceOrderListSearchParamsSchema } from '@/lib/server/validation/contracts'

const DONE_PAGE_SIZE = 20

export default async function ServiceOrdersPage(props: PageProps<never>) {
  const parsedFilters = serviceOrderListSearchParamsSchema.safeParse(await props.searchParams)
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { donePage: 1, q: undefined, date: undefined }

  const { supabase, viewer } = await getCurrentViewer()
  const { active, done, doneTotalPages } = await getServiceOrderList(supabase, viewer, {
    donePage: filters.donePage,
    donePageSize: DONE_PAGE_SIZE,
    q: filters.q,
    date: filters.date,
  })

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Ordini di Lavoro"
        action={
          ['admin', 'secretaria'].includes(viewer.role) ? (
            <Link href="/service-orders/new">
              <Button variant="accent" icon={<Plus size={16} />}>Nuovo O.L.</Button>
            </Link>
          ) : undefined
        }
      />

      <ServiceOrderList
        active={active}
        done={done}
        role={viewer.role}
        userId={viewer.userId}
        donePage={filters.donePage}
        doneTotalPages={doneTotalPages}
        initialQ={filters.q ?? ''}
        initialDate={filters.date ?? ''}
      />
    </div>
  )
}
