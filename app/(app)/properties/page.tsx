import Link from 'next/link'
import { PropertyList } from '@/components/properties/PropertyList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getPropertyList } from '@/lib/server/data-access/properties'

const PAGE_SIZE = 20

export default async function PropertiesPage(props: PageProps<never>) {
  const { page: pageParam, q } = await props.searchParams as { page?: string; q?: string }
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const { supabase, viewer } = await getCurrentViewer()
  const { items, totalPages } = await getPropertyList(supabase, viewer, {
    page,
    pageSize: PAGE_SIZE,
    q,
  })

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Immobili"
        action={
          viewer.role === 'admin' ? (
            <Link href="/properties/new">
              <Button variant="accent" icon={<Plus size={16} />}>Nuovo Immobile</Button>
            </Link>
          ) : undefined
        }
      />

      <PropertyList
        properties={items}
        role={viewer.role}
        currentPage={page}
        totalPages={totalPages}
        q={q ?? ''}
      />
    </div>
  )
}
