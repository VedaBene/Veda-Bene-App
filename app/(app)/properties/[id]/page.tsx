import { notFound } from 'next/navigation'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteProperty } from '../actions'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getPropertyDetail, getPropertyFormOptions } from '@/lib/server/data-access/properties'
import { idParamSchema } from '@/lib/server/validation/contracts'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const parsedParams = idParamSchema.safeParse(await params)
  if (!parsedParams.success) notFound()

  const { id } = parsedParams.data
  const { supabase, viewer } = await getCurrentViewer()
  const property = await getPropertyDetail(supabase, viewer, id)

  if (!property) notFound()

  const { agencies, owners } = await getPropertyFormOptions(supabase, viewer)
  const canEdit = viewer.role === 'admin'

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={property.name} />
      <PropertyForm
        property={property}
        agencies={agencies}
        owners={owners}
        role={viewer.role}
        deleteAction={viewer.role === 'admin' ? deleteProperty.bind(null, id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
