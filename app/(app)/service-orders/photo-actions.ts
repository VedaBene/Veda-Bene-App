'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { pseudonymousSentryUser } from '@/lib/observability/sentry-privacy'
import { getCurrentViewer } from '@/lib/server/data-access/viewer'
import { isCleaningPhotosEnabled } from '@/lib/server/features'
import { withLogging } from '@/lib/server/logger'
import {
  cancelCleaningPhotoUpload,
  abortCleaningPhotoUpload,
  deleteCleaningPhoto,
  finalizeCleaningPhotoUpload,
  reserveCleaningPhotoUpload,
} from '@/lib/server/service-order-photos'
import {
  CLEANING_PHOTO_LIMIT_CODE,
  CLEANING_PHOTO_LIMIT_MESSAGE,
  type CleaningPhotoContentType,
  type CleaningPhotoPhase,
} from '@/lib/types/service-order-photos'

function assertEnabled() {
  if (!isCleaningPhotosEnabled()) throw new Error('La funzione foto non è attiva.')
}

async function getPhotoViewer() {
  const result = await getCurrentViewer()
  Sentry.setUser(pseudonymousSentryUser(result.viewer.userId))
  return result
}

function withPhotoLogging<T>(name: string, fn: () => Promise<T>) {
  return Sentry.withIsolationScope(scope => {
    scope.setUser(null)
    scope.setTag('area', 'cleaning-photo')
    return withLogging(name, fn)
  })
}

async function reserveImpl(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  clientUploadId: string,
  contentType: CleaningPhotoContentType,
) {
  assertEnabled()
  const { supabase, viewer } = await getPhotoViewer()
  try {
    const upload = await reserveCleaningPhotoUpload(supabase, viewer, {
      serviceOrderId,
      phase,
      clientUploadId,
      contentType,
    })
    return { success: true as const, upload }
  } catch (error) {
    if (error instanceof Error && error.message === CLEANING_PHOTO_LIMIT_MESSAGE) {
      return {
        success: false as const,
        code: CLEANING_PHOTO_LIMIT_CODE,
        error: CLEANING_PHOTO_LIMIT_MESSAGE,
      }
    }
    throw error
  }
}

async function finalizeImpl(photoId: string) {
  assertEnabled()
  const { supabase, viewer } = await getPhotoViewer()
  return finalizeCleaningPhotoUpload(supabase, viewer, { photoId })
}

async function cancelImpl(photoId: string) {
  assertEnabled()
  const { supabase, viewer } = await getPhotoViewer()
  await cancelCleaningPhotoUpload(supabase, viewer, photoId)
  return { success: true as const }
}

async function deleteImpl(photoId: string) {
  assertEnabled()
  const { viewer } = await getPhotoViewer()
  await deleteCleaningPhoto(viewer, photoId)
  revalidatePath('/service-orders')
  return { success: true as const }
}

export async function reserveCleaningPhoto(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  clientUploadId: string,
  contentType: CleaningPhotoContentType,
) {
  return withPhotoLogging('reserveCleaningPhoto', () =>
    reserveImpl(serviceOrderId, phase, clientUploadId, contentType),
  )
}

export async function finalizeCleaningPhoto(photoId: string) {
  return withPhotoLogging('finalizeCleaningPhoto', () => finalizeImpl(photoId))
}

export async function cancelCleaningPhoto(photoId: string) {
  return withPhotoLogging('cancelCleaningPhoto', () => cancelImpl(photoId))
}

export async function abortCleaningPhoto(photoId: string) {
  return withPhotoLogging('abortCleaningPhoto', async () => {
    assertEnabled()
    const { viewer } = await getPhotoViewer()
    return abortCleaningPhotoUpload(viewer, photoId)
  })
}

export async function deleteServiceOrderPhoto(photoId: string) {
  return withPhotoLogging('deleteServiceOrderPhoto', () => deleteImpl(photoId))
}
