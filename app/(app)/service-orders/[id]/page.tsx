import { notFound } from 'next/navigation'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteServiceOrder } from '../actions'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import {
  getServiceOrderDetail,
  getServiceOrderFormOptions,
} from '@/lib/server/data-access/service-orders'

export default async function ServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, viewer } = await getCurrentViewer()
  const [order, { properties, staff }] = await Promise.all([
    getServiceOrderDetail(supabase, viewer, id),
    getServiceOrderFormOptions(supabase, viewer),
  ])

  if (!order) notFound()

  const canEdit = ['admin', 'secretaria'].includes(viewer.role)

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Ordine di Lavoro" />
      <ServiceOrderForm
        order={order}
        properties={properties}
        staff={staff}
        role={viewer.role}
        userId={viewer.userId}
        deleteAction={['admin', 'secretaria'].includes(viewer.role) ? deleteServiceOrder.bind(null, id) : undefined}
        readOnly={!canEdit}
      />
    </div>
  )
}
