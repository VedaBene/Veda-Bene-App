import 'server-only'

import { validateCleaningTrackingTransition } from '@/lib/service-order-tracking'
import type { Viewer, SupabaseServerClient } from '@/lib/server/data-access/viewer'
import {
  cleaningPhotoIdsSchema,
  finalizeCleaningPhotoSchema,
  reserveCleaningPhotoSchema,
} from '@/lib/server/validation/service-order-photos'
import {
  createPhotoUploadTokens,
  deletePhotoRecordAndObjects,
  deletePendingPhotoRecordAndObjects,
  findPhotoById,
  findPhotosByIds,
  inspectImageObject,
  listPhotoRecords,
  markPhotoReady,
  MAX_DISPLAY_BYTES,
  MAX_THUMBNAIL_BYTES,
  PhotoInspectionError,
  PhotoCleanupError,
  reservePhotoRecord,
} from '@/lib/server/storage/service-order-photo-storage'
import type {
  CleaningPhotoPhase,
  ReservedCleaningPhotoUpload,
  ServiceOrderPhotoRecord,
  FinalizeCleaningPhotoResult,
  AbortCleaningPhotoResult,
} from '@/lib/types/service-order-photos'
import { MAX_CLEANING_PHOTOS } from '@/lib/types/service-order-photos'
import { CleaningPhotoLimitError } from '@/lib/types/cleaning-photo-errors'
import { validationMessage } from '@/lib/server/validation/contracts'

const PHOTO_OPERATOR_ROLES = new Set(['admin', 'secretaria', 'limpeza'])
const STALE_RESERVATION_MS = 24 * 60 * 60 * 1000

type TrackingOrder = {
  id: string
  status: 'open' | 'in_progress' | 'done'
  started_at: string | null
  completed_at: string | null
  cleaning_cycle: number
}

async function loadAuthorizedOrderForPhase(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
): Promise<TrackingOrder> {
  if (!PHOTO_OPERATOR_ROLES.has(viewer.role)) throw new Error('Sem permissão')

  const { data, error } = await supabase
    .from('service_orders')
    .select('id, status, started_at, completed_at, cleaning_cycle')
    .eq('id', serviceOrderId)
    .maybeSingle()

  if (error) throw new Error('Não foi possível consultar a O.S.')
  if (!data) throw new Error('O.L. non trovato o non autorizzato.')

  const order = data as TrackingOrder
  const transitionError = validateCleaningTrackingTransition(
    phase === 'before' ? 'start' : 'finish',
    order,
  )
  if (transitionError) throw new Error(transitionError)
  return order
}

async function cleanupStaleReservations(records: ServiceOrderPhotoRecord[]) {
  const cutoff = Date.now() - STALE_RESERVATION_MS
  const stale = records.filter(
    record => record.status === 'pending' && new Date(record.created_at).getTime() < cutoff,
  )
  await Promise.allSettled(stale.map(deletePhotoRecordAndObjects))
}

async function cleanupAbandonedOwnReservations(
  records: ServiceOrderPhotoRecord[],
  uploadedBy: string,
) {
  const abandoned = records.filter(
    record => record.status === 'pending' && record.uploaded_by === uploadedBy,
  )
  await Promise.allSettled(abandoned.map(deletePhotoRecordAndObjects))
}

export async function reserveCleaningPhotoUpload(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  input: unknown,
): Promise<ReservedCleaningPhotoUpload> {
  const parsed = reserveCleaningPhotoSchema.safeParse(input)
  if (!parsed.success) throw new Error(validationMessage(parsed.error))

  const { serviceOrderId, phase, clientUploadId, contentType } = parsed.data
  const order = await loadAuthorizedOrderForPhase(supabase, viewer, serviceOrderId, phase)

  const existing = await findPhotoById(clientUploadId)
  if (existing) {
    const belongsToRequest =
      existing.service_order_id === serviceOrderId &&
      existing.cycle_no === order.cleaning_cycle &&
      existing.phase === phase &&
      existing.content_type === contentType &&
      existing.uploaded_by === viewer.userId
    if (!belongsToRequest || existing.status !== 'pending') {
      throw new Error('Questa foto è già stata utilizzata.')
    }
    return createPhotoUploadTokens(existing)
  }

  let records = await listPhotoRecords(serviceOrderId, order.cleaning_cycle, phase)
  await cleanupStaleReservations(records)
  await cleanupAbandonedOwnReservations(records, viewer.userId)
  records = await listPhotoRecords(serviceOrderId, order.cleaning_cycle, phase)

  const usedSlots = new Set(records.map(record => record.sort_order))
  const sortOrder = Array.from({ length: MAX_CLEANING_PHOTOS }, (_, index) => index)
    .find(index => !usedSlots.has(index))
  if (sortOrder === undefined) throw new CleaningPhotoLimitError()

  const record = await reservePhotoRecord({
    id: clientUploadId,
    serviceOrderId,
    cycleNo: order.cleaning_cycle,
    phase,
    contentType,
    uploadedBy: viewer.userId,
    sortOrder,
  })

  try {
    return await createPhotoUploadTokens(record)
  } catch (error) {
    await deletePhotoRecordAndObjects(record).catch(() => undefined)
    throw error
  }
}

export async function finalizeCleaningPhotoUpload(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  input: unknown,
): Promise<FinalizeCleaningPhotoResult> {
  const parsed = finalizeCleaningPhotoSchema.safeParse(input)
  if (!parsed.success) throw new Error(validationMessage(parsed.error))
  if (!PHOTO_OPERATOR_ROLES.has(viewer.role)) throw new Error('Sem permissão')

  const record = await findPhotoById(parsed.data.photoId)
  if (!record || record.uploaded_by !== viewer.userId) {
    throw new Error('Foto non trovata o non autorizzata.')
  }
  if (record.status === 'ready') return { success: true, photoId: record.id }

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, cleaning_cycle')
    .eq('id', record.service_order_id)
    .maybeSingle()
  if (!order || order.cleaning_cycle !== record.cycle_no) {
    throw new Error('Il ciclo di pulizia è cambiato. Seleziona nuovamente la foto.')
  }

  try {
    const display = await inspectImageObject(record.display_path, record.content_type, {
      maxBytes: MAX_DISPLAY_BYTES,
      maxDimension: 1920,
    })
    const thumbnail = await inspectImageObject(record.thumbnail_path, record.content_type, {
      maxBytes: MAX_THUMBNAIL_BYTES,
      maxDimension: 480,
    })

    await markPhotoReady(record.id, {
      width: display.width,
      height: display.height,
      displaySizeBytes: display.size,
      thumbnailSizeBytes: thumbnail.size,
    })
    return { success: true, photoId: record.id }
  } catch (error) {
    if (error instanceof PhotoInspectionError) {
      return { success: false, code: error.code, error: error.message }
    }
    // A failed response from markPhotoReady may hide a successful write.
    // Never delete here: the caller must reconcile through the pending-only abort.
    throw error
  }
}

export async function abortCleaningPhotoUpload(
  viewer: Viewer,
  photoId: unknown,
): Promise<AbortCleaningPhotoResult> {
  const parsed = finalizeCleaningPhotoSchema.safeParse({ photoId })
  if (!parsed.success) throw new Error(validationMessage(parsed.error))
  const record = await findPhotoById(parsed.data.photoId)
  // Another cleanup may have claimed the row while its Storage removal is
  // still active. Missing metadata cannot confirm removal of either object.
  if (!record) return {
    success: false,
    code: 'photo_cleanup_manual_attention',
    error: 'Pulizia della foto non confermata. Contatta l’assistenza prima di riprovare.',
  }
  if (record.uploaded_by !== viewer.userId && viewer.role !== 'admin') throw new Error('Sem permissão')
  try {
    const status = record.status === 'ready' ? 'ready' : await deletePendingPhotoRecordAndObjects(record)
    return { success: true, status, photoId: record.id }
  } catch (error) {
    if (error instanceof PhotoCleanupError) return { success: false, code: error.code, error: error.message }
    throw error
  }
}

export async function cancelCleaningPhotoUpload(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  photoId: unknown,
) {
  const parsed = finalizeCleaningPhotoSchema.safeParse({ photoId })
  if (!parsed.success) throw new Error(validationMessage(parsed.error))

  const record = await findPhotoById(parsed.data.photoId)
  if (!record) return
  if (record.uploaded_by !== viewer.userId && viewer.role !== 'admin') throw new Error('Sem permissão')
  if (record.status === 'ready' && viewer.role !== 'admin') {
    const order = await loadAuthorizedOrderForPhase(supabase, viewer, record.service_order_id, record.phase)
    if (order.cleaning_cycle !== record.cycle_no) throw new Error('Sem permissão')
  }
  await deletePhotoRecordAndObjects(record)
}

export async function deleteCleaningPhoto(viewer: Viewer, photoId: unknown) {
  if (viewer.role !== 'admin') throw new Error('Sem permissão')
  const parsed = finalizeCleaningPhotoSchema.safeParse({ photoId })
  if (!parsed.success) throw new Error(validationMessage(parsed.error))

  const record = await findPhotoById(parsed.data.photoId)
  if (record) await deletePhotoRecordAndObjects(record)
}

export async function validateReadyPhotosForTransition(input: {
  serviceOrderId: string
  cycleNo: number
  phase: CleaningPhotoPhase
  photoIds: unknown
  uploadedBy: string
}) {
  const parsed = cleaningPhotoIdsSchema.safeParse(input.photoIds)
  if (!parsed.success) throw new Error(validationMessage(parsed.error))
  if (parsed.data.length === 0) return

  const records = await findPhotosByIds(parsed.data)
  const valid = records.length === parsed.data.length && records.every(record =>
    record.service_order_id === input.serviceOrderId &&
    record.cycle_no === input.cycleNo &&
    record.phase === input.phase &&
    record.status === 'ready' &&
    record.uploaded_by === input.uploadedBy,
  )
  if (!valid) throw new Error('Una o più foto non sono valide per questa fase della pulizia.')
}
