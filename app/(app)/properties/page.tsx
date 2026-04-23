import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { PropertyList } from '@/components/properties/PropertyList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { toPropertyListItem } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { PropertyListItem } from '@/lib/types/view-models'

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  const propertiesSelect =
    role === 'admin' || role === 'secretaria'
      ? 'id, name, zone, address, client_type, base_price'
      : 'id, name, zone, address'

  const { data: properties } = await supabase
    .from('properties')
    .select(propertiesSelect)
    .order('created_at', { ascending: false })

  const items = ((properties ?? []) as PropertyListItem[]).map(property =>
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
      />
    </div>
  )
}
