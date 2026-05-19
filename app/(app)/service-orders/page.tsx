import Link from 'next/link'
import { ServiceOrderList } from '@/components/service-orders/ServiceOrderList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getServiceOrderList } from '@/lib/server/data-access/service-orders'

const DONE_PAGE_SIZE = 20

export default async function ServiceOrdersPage(props: PageProps<never>) {
  const { donePage: donePageParam, q, date } = await props.searchParams as {
    donePage?: string
    q?: string
    date?: string
  }

  const donePage = Math.max(1, parseInt(donePageParam ?? '1', 10) || 1)

  const { supabase, viewer } = await getCurrentViewer()
  const { active, done, doneTotalPages } = await getServiceOrderList(supabase, viewer, {
    donePage,
    donePageSize: DONE_PAGE_SIZE,
    q,
    date,
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
        donePage={donePage}
        doneTotalPages={doneTotalPages}
        initialQ={q ?? ''}
        initialDate={date ?? ''}
      />
    </div>
  )
}
