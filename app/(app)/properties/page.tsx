import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { PropertyList } from '@/components/properties/PropertyList'
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Imóveis</h1>
        {['admin', 'secretaria'].includes(role) && (
          <Link
            href="/properties/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Novo Imóvel
          </Link>
        )}
      </div>

      <PropertyList
        properties={(properties ?? []) as (Property & { agency: Agency | null; owner: Owner | null })[]}
        role={role}
      />
    </div>
  )
}
