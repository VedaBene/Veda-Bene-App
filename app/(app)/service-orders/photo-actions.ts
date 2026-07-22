'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { isCleaningPhotosEnabled } from '@/lib/server/features'
import { withLogging } from '@/lib/server/logger'
import {
  cancelCleaningPhotoUpload,
  deleteCleaningPhoto,
  finalizeCleaningPhotoUpload,
  reserveCleaningPhotoUpload,
} from '@/lib/server/service-order-photos'
import type { CleaningPhotoPhase } from '@/lib/types/service-order-photos'

function assertEnabled() {
  if (!isCleaningPhotosEnabled()) throw new Error('La funzione foto non è attiva.')
}

async function reserveImpl(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  clientUploadId: string,
) {
  assertEnabled()
  const { supabase, viewer } = await getCurrentViewer()
  const upload = await reserveCleaningPhotoUpload(supabase, viewer, {
    serviceOrderId,
    phase,
    clientUploadId,
  })
  return { success: true as const, upload }
}

async function finalizeImpl(photoId: string) {
  assertEnabled()
  const { supabase, viewer } = await getCurrentViewer()
  const result = await finalizeCleaningPhotoUpload(supabase, viewer, { photoId })
  return { success: true as const, ...result }
}

async function cancelImpl(photoId: string) {
  assertEnabled()
  const { supabase, viewer } = await getCurrentViewer()
  await cancelCleaningPhotoUpload(supabase, viewer, photoId)
  return { success: true as const }
}

async function deleteImpl(photoId: string) {
  assertEnabled()
  const { viewer } = await getCurrentViewer()
  await deleteCleaningPhoto(viewer, photoId)
  revalidatePath('/service-orders')
  return { success: true as const }
}

export async function reserveCleaningPhoto(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  clientUploadId: string,
) {
  return withLogging('reserveCleaningPhoto', () => reserveImpl(serviceOrderId, phase, clientUploadId))
}

export async function finalizeCleaningPhoto(photoId: string) {
  return withLogging('finalizeCleaningPhoto', () => finalizeImpl(photoId))
}

export async function cancelCleaningPhoto(photoId: string) {
  return withLogging('cancelCleaningPhoto', () => cancelImpl(photoId))
}

export async function deleteServiceOrderPhoto(photoId: string) {
  return withLogging('deleteServiceOrderPhoto', () => deleteImpl(photoId))
}
