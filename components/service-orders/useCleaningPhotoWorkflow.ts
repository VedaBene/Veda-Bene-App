'use client'

import { useEffect, useRef, useState } from 'react'
import {
  cancelCleaningPhoto,
  finalizeCleaningPhoto,
  reserveCleaningPhoto,
} from '@/app/(app)/service-orders/photo-actions'
import { createClient } from '@/utils/supabase/client'
import {
  MAX_CLEANING_PHOTOS,
  processCleaningPhoto,
  validateSourceImage,
} from '@/lib/client/image-processing'
import type { CleaningPhotoPhase } from '@/lib/types/service-order-photos'

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

async function uploadVariant(path: string, token: string, blob: Blob) {
  const supabase = createClient()
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.storage
      .from('service-order-photos')
      .uploadToSignedUrl(path, token, blob, {
        contentType: 'image/webp',
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
    const available = MAX_CLEANING_PHOTOS - items.length
    if (selected.length > available) {
      setSelectionError(`Puoi aggiungere al massimo ${MAX_CLEANING_PHOTOS} foto.`)
    }

    const accepted: CleaningPhotoQueueItem[] = []
    for (const file of selected.slice(0, Math.max(0, available))) {
      const validationError = validateSourceImage(file)
      if (validationError) {
        setSelectionError(validationError)
        continue
      }
      accepted.push({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle',
      })
    }
    setItems(current => [...current, ...accepted])
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
    if (!enabled || items.length === 0) return []
    setIsUploading(true)
    const uploadedIds: string[] = []

    try {
      for (const item of items) {
        if (item.status === 'ready' && item.photoId) {
          uploadedIds.push(item.photoId)
          continue
        }

        let photoId = item.localId
        try {
          updateItem(item.localId, { status: 'processing', error: undefined })
          const processed = await processCleaningPhoto(item.file)
          const reserved = await reserveCleaningPhoto(serviceOrderId, phase, photoId)
          photoId = reserved.upload.photoId
          updateItem(item.localId, { status: 'uploading', photoId })

          const uploads = await Promise.allSettled([
            uploadVariant(reserved.upload.display.path, reserved.upload.display.token, processed.display),
            uploadVariant(reserved.upload.thumbnail.path, reserved.upload.thumbnail.token, processed.thumbnail),
          ])

          // Finalization is authoritative. It also handles an ambiguous network
          // response where Storage accepted the bytes but the browser saw an error.
          const finalized = await finalizeCleaningPhoto(photoId)
          if (!finalized.success || uploads.some(result => result.status === 'rejected')) {
            // A successful finalization proves both files arrived, so rejected
            // upload promises caused by lost responses can be ignored.
          }
          updateItem(item.localId, { status: 'ready', photoId, error: undefined })
          uploadedIds.push(photoId)
        } catch (error) {
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
