'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useRef, useState } from 'react'
import {
  cancelCleaningPhoto,
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
import { appendWithinLimit } from '@/lib/client/cleaning-photo-queue'
import type { CleaningPhotoContentType, CleaningPhotoPhase } from '@/lib/types/service-order-photos'

export type CleaningPhotoQueueItem = {
  localId: string
  file: File
  previewUrl: string
  status: 'idle' | 'processing' | 'uploading' | 'ready' | 'error'
  error?: string
  photoId?: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Errore durante il caricamento della foto.'
}

class CleaningPhotoWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'CleaningPhotoWorkflowError'
  }
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
  file: File,
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
      source_content_type: sourceContentTypeTag(file.type),
      source_size_bucket: sourceSizeBucket(file.size),
    },
    extra: processingError?.details,
  })
}

async function uploadVariant(
  path: string,
  token: string,
  blob: Blob,
  contentType: CleaningPhotoContentType,
) {
  if (blob.type !== contentType) throw new Error('Il formato elaborato non corrisponde alla prenotazione.')
  const supabase = createClient()
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.storage
      .from('service-order-photos')
      .uploadToSignedUrl(path, token, blob, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      })
    if (!error) return
    lastError = new Error(error.message)
    await new Promise(resolve => window.setTimeout(resolve, 400 * (attempt + 1)))
  }
  throw lastError ?? new Error('Caricamento non riuscito.')
}

export function useCleaningPhotoWorkflow(
  serviceOrderId: string,
  phase: CleaningPhotoPhase,
  enabled: boolean,
) {
  const [items, setItems] = useState<CleaningPhotoQueueItem[]>([])
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => () => {
    itemsRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl))
  }, [])

  function addFiles(files: FileList | null) {
    if (!enabled || !files) return
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

    const result = appendWithinLimit(
      itemsRef.current,
      valid,
      MAX_CLEANING_PHOTOS,
      file => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle' as const,
      }),
    )
    itemsRef.current = result.items
    setItems(result.items)
    if (result.rejectedCount > 0) {
      setSelectionError(`Puoi aggiungere al massimo ${MAX_CLEANING_PHOTOS} foto.`)
    }
  }

  async function removeItem(localId: string) {
    const item = items.find(candidate => candidate.localId === localId)
    if (!item || isUploading) return
    setIsUploading(true)
    try {
      if (item.photoId) await cancelCleaningPhoto(item.photoId)
      URL.revokeObjectURL(item.previewUrl)
      setItems(current => current.filter(candidate => candidate.localId !== localId))
    } finally {
      setIsUploading(false)
    }
  }

  function updateItem(localId: string, update: Partial<CleaningPhotoQueueItem>) {
    setItems(current => current.map(item => item.localId === localId ? { ...item, ...update } : item))
  }

  async function uploadAll(): Promise<string[]> {
    const queuedItems = itemsRef.current
    if (!enabled || queuedItems.length === 0) return []
    setIsUploading(true)
    const uploadedIds: string[] = []

    try {
      for (const item of queuedItems) {
        if (item.status === 'ready' && item.photoId) {
          uploadedIds.push(item.photoId)
          continue
        }

        let photoId = item.localId
        let failureStage: 'processing' | 'reservation' | 'upload' | 'finalization' = 'processing'
        try {
          updateItem(item.localId, { status: 'processing', error: undefined })
          const processed = await processCleaningPhoto(item.file)
          failureStage = 'reservation'
          const reserved = await reserveCleaningPhoto(
            serviceOrderId,
            phase,
            photoId,
            processed.contentType,
          )
          if (!reserved.success) {
            throw new CleaningPhotoWorkflowError(reserved.error, reserved.code)
          }
          photoId = reserved.upload.photoId
          if (reserved.upload.contentType !== processed.contentType) {
            throw new Error('Il formato prenotato non corrisponde alla foto elaborata.')
          }
          updateItem(item.localId, { status: 'uploading', photoId })

          failureStage = 'upload'
          const uploads = await Promise.allSettled([
            uploadVariant(
              reserved.upload.display.path,
              reserved.upload.display.token,
              processed.display,
              processed.contentType,
            ),
            uploadVariant(
              reserved.upload.thumbnail.path,
              reserved.upload.thumbnail.token,
              processed.thumbnail,
              processed.contentType,
            ),
          ])

          // Finalization is authoritative. It also handles an ambiguous network
          // response where Storage accepted the bytes but the browser saw an error.
          failureStage = 'finalization'
          const finalized = await finalizeCleaningPhoto(photoId)
          if (!finalized.success || uploads.some(result => result.status === 'rejected')) {
            // A successful finalization proves both files arrived, so rejected
            // upload promises caused by lost responses can be ignored.
          }
          updateItem(item.localId, { status: 'ready', photoId, error: undefined })
          uploadedIds.push(photoId)
        } catch (error) {
          capturePhotoFailure(error, item.file, phase, failureStage)
          await cancelCleaningPhoto(photoId).catch(() => undefined)
          updateItem(item.localId, { status: 'error', photoId: undefined, error: errorMessage(error) })
          throw error
        }
      }
      return uploadedIds
    } finally {
      setIsUploading(false)
    }
  }

  function reset() {
    items.forEach(item => URL.revokeObjectURL(item.previewUrl))
    setItems([])
    setSelectionError(null)
  }

  async function discardAll() {
    setIsUploading(true)
    try {
      await Promise.allSettled(
        items.filter(item => item.photoId).map(item => cancelCleaningPhoto(item.photoId!)),
      )
      reset()
    } finally {
      setIsUploading(false)
    }
  }

  return {
    items,
    selectionError,
    isUploading,
    addFiles,
    removeItem,
    uploadAll,
    reset,
    discardAll,
  }
}
