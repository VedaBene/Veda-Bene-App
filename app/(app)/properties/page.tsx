import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { PropertyList } from '@/components/properties/PropertyList'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import type { Agency, Owner, Property, Role } from '@/lib/types/database'

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  const { data: properties } = await supabase
    .from('properties')
    .select('*, agency:agencies(*), owner:owners(*)')
    .order('created_at', { ascending: false })

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
        properties={(properties ?? []) as (Property & { agency: Agency | null; owner: Owner | null })[]}
        role={role}
      />
    </div>
  )
}
