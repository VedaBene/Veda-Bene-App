import { notFound } from 'next/navigation'
import { ServiceOrderForm } from '@/components/service-orders/ServiceOrderForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { deleteServiceOrder } from '../actions'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import {
  getServiceOrderDetail,
  getServiceOrderFormOptions,
} from '@/lib/server/data-access/service-orders'
import { idParamSchema } from '@/lib/server/validation/contracts'
import { isCleaningPhotosEnabled } from '@/lib/server/features'
import { getCleaningPhotoGallery } from '@/lib/server/data-access/service-order-photos'
import { CleaningPhotoGallery } from '@/components/service-orders/CleaningPhotoGallery'

export default async function ServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const parsedParams = idParamSchema.safeParse(await params)
  if (!parsedParams.success) notFound()

  const { id } = parsedParams.data
  const { supabase, viewer } = await getCurrentViewer()
  const [order, { properties, staff }] = await Promise.all([
    getServiceOrderDetail(supabase, viewer, id),
    getServiceOrderFormOptions(supabase, viewer),
  ])

  if (!order) notFound()

  const canEdit = ['admin', 'secretaria'].includes(viewer.role)
  const cleaningPhotosEnabled = isCleaningPhotosEnabled()
  const photoCycles = cleaningPhotosEnabled && order.status === 'done'
    ? await getCleaningPhotoGallery(supabase, viewer, id)
    : []

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
        cleaningPhotosEnabled={cleaningPhotosEnabled}
        photoGallery={cleaningPhotosEnabled && order.status === 'done' ? (
          <CleaningPhotoGallery cycles={photoCycles} />
        ) : undefined}
      />
    </div>
  )
}
