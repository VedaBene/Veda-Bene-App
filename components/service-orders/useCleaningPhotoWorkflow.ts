'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  cancelCleaningPhoto,
  abortCleaningPhoto,
  finalizeCleaningPhoto,
  reserveCleaningPhoto,
} from '@/app/(app)/service-orders/photo-actions'
import { createClient } from '@/utils/supabase/client'
import {
  MAX_CLEANING_PHOTOS,
  PhotoProcessingError,
  processCleaningPhoto,
  validateSourceImage,
} from '@/lib/client/image-processing'
import {
  createCleaningPhotoPreparationQueue,
  createSequentialPhotoPreparation,
  type CleaningPhotoQueueItem,
} from '@/lib/client/cleaning-photo-queue'
import { CleaningPhotoWorkflowError, uploadPreparedCleaningPhoto } from '@/lib/client/cleaning-photo-upload'
import type { CleaningPhotoPhase } from '@/lib/types/service-order-photos'

export type { CleaningPhotoQueueItem } from '@/lib/client/cleaning-photo-queue'

const runPhotoPreparation = createSequentialPhotoPreparation()

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Errore durante il caricamento della foto.'
}

function sourceSizeBucket(bytes: number) {
  if (bytes <= 2 * 1024 * 1024) return 'lte_2mb'
  if (bytes <= 8 * 1024 * 1024) return '2mb_to_8mb'
  return 'gt_8mb'
}

function sourceContentTypeTag(contentType: string) {
  if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp') {
    return contentType
  }
  return contentType ? 'other' : 'unknown'
}

function capturePhotoFailure(
  error: unknown,
  source: CleaningPhotoQueueItem['source'],
  phase: CleaningPhotoPhase,
  stage: 'processing' | 'reservation' | 'upload' | 'finalization',
) {
  const exception = error instanceof Error ? error : new Error(String(error))
  const processingError = error instanceof PhotoProcessingError ? error : null
  const workflowError = error instanceof CleaningPhotoWorkflowError ? error : null
  Sentry.captureException(exception, {
    level: processingError || workflowError ? 'warning' : 'error',
    tags: {
      area: 'cleaning-photo',
      phase,
      stage,
      failure_code: processingError?.code ?? workflowError?.code ?? 'workflow_error',
      source_content_type: sourceContentTypeTag(source.type),
      source_size_bucket: sourceSizeBucket(source.size),
    },
    extra: processingError?.details,
  })
}

export function useCleaningPhotoWorkflow(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  enabled: boolean,
) {
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const uploadLock = useRef(false)
  const [queue] = useState(() => createCleaningPhotoPreparationQueue({
    process: processCleaningPhoto,
    createPreview: thumbnail => URL.createObjectURL(thumbnail),
    revokePreview: url => URL.revokeObjectURL(url),
    createId: () => crypto.randomUUID(),
    yieldToBrowser: () => new Promise(resolve => window.setTimeout(resolve, 0)),
    runExclusive: runPhotoPreparation,
    onFailure: (error, source) => capturePhotoFailure(error, source, phase, 'processing'),
  }))
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  const isPreparing = items.some(item => item.status === 'queued' || item.status === 'processing')
  const canUpload = !isPreparing && items.every(item => !item.cleanupRequiresSupport && (item.status === 'ready' || !!item.processed))

  useEffect(() => () => {
    queue.clear()
  }, [queue])

  function addFiles(files: FileList | null) {
    if (!enabled || !files || uploadLock.current) return
    setSelectionError(null)
    const selected = Array.from(files)
    const valid: File[] = []
    for (const file of selected) {
      const validationError = validateSourceImage(file)
      if (validationError) {
        setSelectionError(validationError)
        continue
      }
      valid.push(file)
    }

    if (queue.add(valid, MAX_CLEANING_PHOTOS) > 0) {
      setSelectionError(`Puoi aggiungere al massimo ${MAX_CLEANING_PHOTOS} foto.`)
    }
  }

  async function removeItem(localId: string) {
    const item = queue.getSnapshot().find(candidate => candidate.localId === localId)
    if (!item || uploadLock.current) return
    if (!item.photoId) {
      queue.remove(localId)
      return
    }
    uploadLock.current = true
    setIsUploading(true)
    try {
      if (item.photoId) await cancelCleaningPhoto(item.photoId)
      queue.remove(localId)
    } finally {
      uploadLock.current = false
      setIsUploading(false)
    }
  }

  function updateItem(localId: string, update: Partial<CleaningPhotoQueueItem>) {
    queue.update(localId, update)
  }

  async function uploadAll(): Promise<string[]> {
    const queuedItems = queue.getSnapshot()
    if (!enabled || queuedItems.length === 0) return []
    if (uploadLock.current) throw new Error('Caricamento delle foto già in corso.')
    const blockedCleanup = queuedItems.find(item => item.cleanupRequiresSupport)
    if (blockedCleanup) throw new Error(blockedCleanup.error)
    if (queuedItems.some(item => item.status === 'queued' || item.status === 'processing')) {
      throw new Error('Attendi la preparazione delle foto prima di confermare.')
    }
    const failedPreparation = queuedItems.find(item => item.status !== 'ready' && !item.processed)
    if (failedPreparation) {
      throw new Error(failedPreparation.error ?? 'Rimuovi la foto non leggibile e selezionala nuovamente.')
    }
    uploadLock.current = true
    setIsUploading(true)
    const uploadedIds: string[] = []

    try {
      for (const item of queuedItems) {
        if (item.status === 'ready' && item.photoId) {
          uploadedIds.push(item.photoId)
          continue
        }

        try {
          const processed = item.processed!
          updateItem(item.localId, { status: 'uploading', error: undefined })
          const supabase = createClient()
          const photoId = await uploadPreparedCleaningPhoto(processed, {
            reserve: id => reserveCleaningPhoto(serviceOrderId, phase, id, processed.contentType),
            upload: (variant, blob) => supabase.storage.from('service-order-photos')
              .uploadToSignedUrl(variant.path, variant.token, blob, {
                contentType: processed.contentType, cacheControl: '31536000', upsert: false,
              }),
            finalize: finalizeCleaningPhoto,
            abort: abortCleaningPhoto,
            createId: () => crypto.randomUUID(),
            sleep: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
            onReservation: id => updateItem(item.localId, { photoId: id }),
          }, item.photoId)
          updateItem(item.localId, { status: 'ready', photoId, error: undefined })
          uploadedIds.push(photoId)
        } catch (error) {
          const workflowError = error instanceof CleaningPhotoWorkflowError ? error : null
          capturePhotoFailure(error, item.source, phase, workflowError?.stage ?? 'reservation')
          updateItem(item.localId, {
            status: 'error', photoId: workflowError?.pendingPhotoId, error: errorMessage(error),
            cleanupRequiresSupport: workflowError?.code === 'photo_cleanup_manual_attention',
          })
          throw error
        }
      }
      return uploadedIds
    } finally {
      uploadLock.current = false
      setIsUploading(false)
    }
  }

  function reset() {
    queue.clear()
    setSelectionError(null)
  }

  async function discardAll() {
    if (uploadLock.current) return
    uploadLock.current = true
    setIsUploading(true)
    const discarded = queue.getSnapshot()
    reset()
    try {
      await Promise.allSettled(
        discarded.filter(item => item.photoId).map(item => cancelCleaningPhoto(item.photoId!)),
      )
    } finally {
      uploadLock.current = false
      setIsUploading(false)
    }
  }

  return {
    items,
    selectionError,
    isUploading,
    isPreparing,
    canUpload,
    addFiles,
    removeItem,
    uploadAll,
    reset,
    discardAll,
  }
}
