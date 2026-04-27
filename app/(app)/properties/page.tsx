import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PropertyList } from '@/components/properties/PropertyList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { toPropertyListItem } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { PropertyListItem } from '@/lib/types/view-models'

const PAGE_SIZE = 20

export default async function PropertiesPage(props: PageProps<never>) {
  const { page: pageParam, q } = await props.searchParams as { page?: string; q?: string }
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  const propertiesSelect =
    role === 'admin'
      ? 'id, name, zone, address, client_type, base_price'
      : role === 'secretaria'
        ? 'id, name, zone, address, client_type'
        : 'id, name, zone, address'

  let query = supabase
    .from('properties')
    .select(propertiesSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: properties, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const items = ((properties ?? []) as unknown as PropertyListItem[]).map(property =>
    toPropertyListItem(property, role),
  )

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Imóveis"
        action={
          role === 'admin' ? (
            <Link href="/properties/new">
              <Button variant="accent" icon={<Plus size={16} />}>Novo Imóvel</Button>
            </Link>
          ) : undefined
        }
      />

      <PropertyList
        properties={items}
        role={role}
        currentPage={page}
        totalPages={totalPages}
        q={q ?? ''}
      />
    </div>
  )
}
