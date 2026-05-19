import { redirect } from 'next/navigation'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { getServiceOrderFormOptions } from '@/lib/server/data-access/service-orders'

export default async function NewServiceOrderPage() {
  const { supabase, viewer } = await getCurrentViewer()

  if (!['admin', 'secretaria'].includes(viewer.role)) redirect('/service-orders')

  const { properties, staff } = await getServiceOrderFormOptions(supabase, viewer)

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Nuovo Ordine di Lavoro" />
      <ServiceOrderForm
        properties={properties}
        staff={staff}
        role={viewer.role}
      />
    </div>
  )
}
