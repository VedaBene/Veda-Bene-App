import { redirect } from 'next/navigation'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getPropertyFormOptions } from '@/lib/server/data-access/properties'

export default async function NewPropertyPage() {
  const { supabase, viewer } = await getCurrentViewer()

  if (viewer.role !== 'admin') redirect('/properties')

  const { agencies, owners } = await getPropertyFormOptions(supabase, viewer)

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Nuovo Immobile" />
      <PropertyForm
        agencies={agencies}
        owners={owners}
        role={viewer.role}
      />
    </div>
  )
}
