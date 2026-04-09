import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { deleteProperty } from '../actions'
import type { Agency, Owner, Property, Role } from '@/lib/types/database'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role

  const [{ data: property }, { data: agencies }, { data: owners }] = await Promise.all([
    supabase.from('properties').select('*, agency:agencies(*), owner:owners(*)').eq('id', id).single(),
    supabase.from('agencies').select('*').order('name'),
    supabase.from('owners').select('*').order('name'),
  ])

  if (!property) notFound()

  const canEdit = ['admin', 'secretaria'].includes(role)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{property.name}</h1>
      <PropertyForm
        property={property as Property & { agency: Agency | null; owner: Owner | null }}
        agencies={(agencies ?? []) as Agency[]}
        owners={(owners ?? []) as Owner[]}
        role={role}
        deleteAction={role === 'admin' ? () => deleteProperty(id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
