import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteProperty } from '../actions'
import { toPropertyFormData } from '@/lib/server/view-models'
import type { Role } from '@/lib/types/database'
import type { PropertyFormData } from '@/lib/types/view-models'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'cliente') as Role
  const propertySelect = [
    'id',
    'name',
    'zone',
    'address',
    'zip_code',
    'sqm_interior',
    'sqm_exterior',
    'sqm_total',
    'min_guests',
    'max_guests',
    'double_beds',
    'single_beds',
    'sofa_beds',
    'armchair_beds',
    'bathrooms',
    'bidets',
    'cribs',
    'bedrooms',
    'notes',
    ...(role === 'admin' || role === 'secretaria'
      ? ['client_type', 'agency_id', 'owner_id', 'phone']
      : []),
    ...(role === 'admin' ? ['base_price', 'extra_per_person', 'avg_cleaning_hours'] : []),
  ].join(', ')

  const { data: rawProperty } = await supabase
    .from('properties')
    .select(propertySelect)
    .eq('id', id)
    .single()

  if (!rawProperty) notFound()

  const property = rawProperty as unknown as PropertyFormData

  let agencies: { id: string; name: string }[] = []
  let owners: { id: string; name: string }[] = []
  if (role === 'admin' || role === 'secretaria') {
    const [{ data: agenciesData }, { data: ownersData }] = await Promise.all([
      supabase.from('agencies').select('id, name').order('name'),
      supabase.from('owners').select('id, name').order('name'),
    ])
    agencies = agenciesData ?? []
    owners = ownersData ?? []
  }

  const canEdit = role === 'admin'

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={property.name} />
      <PropertyForm
        property={toPropertyFormData(property, role)}
        agencies={agencies}
        owners={owners}
        role={role}
        deleteAction={role === 'admin' ? deleteProperty.bind(null, id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
