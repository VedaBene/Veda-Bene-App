import Link from 'next/link'
import { PropertyList } from '@/components/properties/PropertyList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getPropertyList } from '@/lib/server/data-access/properties'
import { propertyListSearchParamsSchema } from '@/lib/server/validation/contracts'

const PAGE_SIZE = 20

export default async function PropertiesPage(props: PageProps<never>) {
  const parsedFilters = propertyListSearchParamsSchema.safeParse(await props.searchParams)
  const filters = parsedFilters.success ? parsedFilters.data : { page: 1, q: undefined }

  const { supabase, viewer } = await getCurrentViewer()
  const { items, totalPages } = await getPropertyList(supabase, viewer, {
    page: filters.page,
    pageSize: PAGE_SIZE,
    q: filters.q,
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
        currentPage={filters.page}
        totalPages={totalPages}
        q={filters.q ?? ''}
      />
    </div>
  )
}
