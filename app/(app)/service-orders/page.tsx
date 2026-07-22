import Link from 'next/link'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getServiceOrderList, getServiceOrderFormOptions } from '@/lib/server/data-access/service-orders'
import { serviceOrderListSearchParamsSchema } from '@/lib/server/validation/contracts'
import { isCleaningPhotosEnabled } from '@/lib/server/features'

const DONE_PAGE_SIZE = 20

export default async function ServiceOrdersPage(props: PageProps<never>) {
  const parsedFilters = serviceOrderListSearchParamsSchema.safeParse(await props.searchParams)
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { donePage: 1, q: undefined, propertyId: undefined, cleaningStaffId: undefined, consegnaStaffId: undefined, startDate: undefined, endDate: undefined }

  const { supabase, viewer } = await getCurrentViewer()

  const [
    { active, done, doneForExport, doneTotalPages, doneTotalCount },
    { staff }
  ] = await Promise.all([
    getServiceOrderList(supabase, viewer, {
      donePage: filters.donePage,
      donePageSize: DONE_PAGE_SIZE,
      q: filters.q,
      propertyId: filters.propertyId,
      cleaningStaffId: filters.cleaningStaffId,
      consegnaStaffId: filters.consegnaStaffId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getServiceOrderFormOptions(supabase, viewer),
  ])

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
        doneForExport={doneForExport}
        role={viewer.role}
        userId={viewer.userId}
        donePage={filters.donePage}
        doneTotalPages={doneTotalPages}
        doneTotalCount={doneTotalCount}
        initialQ={filters.q ?? ''}
        initialCleaningStaffId={filters.cleaningStaffId ?? ''}
        initialConsegnaStaffId={filters.consegnaStaffId ?? ''}
        initialStartDate={filters.startDate ?? ''}
        initialEndDate={filters.endDate ?? ''}
        staff={viewer.role === 'cliente' ? [] : staff}
        cleaningPhotosEnabled={isCleaningPhotosEnabled()}
      />
    </div>
  )
}
