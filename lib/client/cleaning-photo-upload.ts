import type { ProcessedCleaningPhoto } from './image-processing'
import type {
  AbortCleaningPhotoResult, FinalizeCleaningPhotoResult, ReservedCleaningPhotoUpload,
} from '@/lib/types/service-order-photos'

export class CleaningPhotoWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly stage: 'reservation' | 'upload' | 'finalization',
    readonly pendingPhotoId?: string,
  ) {
    super(message)
    this.name = 'CleaningPhotoWorkflowError'
  }
}

export function classifyPhotoUploadFailure(error: unknown): 'transient' | 'ambiguous' | 'definitive' {
  if (error instanceof TypeError) return 'ambiguous'
  if (!error || typeof error !== 'object') return 'definitive'
  const value = error as { status?: number; statusCode?: string; originalError?: unknown }
  if (value.originalError instanceof TypeError) return 'ambiguous'
  if (value.statusCode === 'Duplicate' || value.statusCode === 'AssetAlreadyExists' || value.status === 409) return 'ambiguous'
  const status = value.status ?? Number(value.statusCode)
  return status === 408 || status === 429 || status >= 500 && status <= 599 ? 'transient' : 'definitive'
}

type Dependencies = {
  reserve(id: string): Promise<{ success: true; upload: ReservedCleaningPhotoUpload } | { success: false; code: string; error: string }>
  upload(variant: { path: string; token: string }, blob: Blob): Promise<{ error: unknown }>
  finalize(id: string): Promise<FinalizeCleaningPhotoResult>
  abort(id: string): Promise<AbortCleaningPhotoResult>
  createId(): string
  sleep(ms: number): Promise<void>
  onReservation(id: string): void
}

// No timeout races: every request settles before another upload/cleanup starts.
// Repeated PUTs never overwrite; ambiguous writes are verified by finalization.
async function uploadVariant(deps: Dependencies, variant: { path: string; token: string }, blob: Blob) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let error: unknown
    try { error = (await deps.upload(variant, blob)).error } catch (reason) { error = reason }
    if (!error) return
    const kind = classifyPhotoUploadFailure(error)
    if (kind === 'transient' && attempt === 0) {
      await deps.sleep(400)
      continue
    }
    if (kind === 'definitive') {
      throw new CleaningPhotoWorkflowError('Caricamento non autorizzato o foto non valida. Controlla la sessione e seleziona nuovamente la foto.', 'photo_upload_rejected', 'upload')
    }
    return // Ambiguous/exhausted transient response: verify both objects server-side.
  }
}

async function abortOrFail(deps: Dependencies, id: string) {
  try {
    const result = await deps.abort(id)
    if (!result.success) throw new CleaningPhotoWorkflowError(result.error, result.code, 'finalization', id)
    if (result.photoId !== id) throw new Error('Unexpected cleanup photo')
    return result
  } catch (error) {
    if (error instanceof CleaningPhotoWorkflowError) throw error
    throw new CleaningPhotoWorkflowError(
      'Pulizia del caricamento non confermata. Controlla la connessione e riprova prima di inviare altre foto.',
      'photo_cleanup_unconfirmed', 'finalization', id,
    )
  }
}

export async function uploadPreparedCleaningPhoto(
  processed: ProcessedCleaningPhoto,
  deps: Dependencies,
  previousPhotoId?: string,
): Promise<string> {
  if (previousPhotoId) {
    const previous = await abortOrFail(deps, previousPhotoId)
    if (previous.status === 'ready') return previous.photoId
  }
  if (processed.display.type !== processed.contentType || processed.thumbnail.type !== processed.contentType) {
    throw new CleaningPhotoWorkflowError('Il formato elaborato non corrisponde alla foto.', 'photo_content_invalid', 'upload')
  }

  const usedIds = new Set(previousPhotoId ? [previousPhotoId] : [])
  for (let cycle = 0; cycle < 2; cycle++) {
    const id = deps.createId()
    if (usedIds.has(id)) throw new CleaningPhotoWorkflowError('Seleziona nuovamente la foto e riprova.', 'photo_duplicate_reservation', 'reservation')
    usedIds.add(id)
    deps.onReservation(id)
    let stage: 'reservation' | 'upload' | 'finalization' = 'reservation'
    let reservationRejected = false
    let failure: unknown
    try {
      const reserved = await deps.reserve(id)
      if (!reserved.success) {
        reservationRejected = true
        throw new CleaningPhotoWorkflowError(reserved.error, reserved.code, stage)
      }
      if (reserved.upload.photoId !== id || reserved.upload.contentType !== processed.contentType) {
        throw new CleaningPhotoWorkflowError('La prenotazione non corrisponde alla foto.', 'photo_reservation_mismatch', stage)
      }
      stage = 'upload'
      await uploadVariant(deps, reserved.upload.display, processed.display)
      await uploadVariant(deps, reserved.upload.thumbnail, processed.thumbnail)
      stage = 'finalization'
      const finalized = await deps.finalize(id)
      if (finalized.success) {
        if (finalized.photoId !== id) throw new Error('Unexpected finalized photo')
        return id
      }
      failure = new CleaningPhotoWorkflowError(finalized.error, finalized.code, stage)
    } catch (error) { failure = error }

    // A structured rejection created no reservation; preserve its feedback.
    // Thrown/lost responses remain ambiguous and still require reconciliation.
    if (reservationRejected) throw failure

    // Also reconciles a lost finalization response: ready is preserved and reused.
    const cleanup = await abortOrFail(deps, id)
    if (cleanup.status === 'ready' && stage !== 'reservation') return cleanup.photoId
    if (failure instanceof CleaningPhotoWorkflowError && failure.code === 'photo_variant_missing' && cycle === 0) {
      await deps.sleep(400)
      continue // Complete retry, new UUID => new immutable paths.
    }
    if (failure instanceof CleaningPhotoWorkflowError) throw failure
    throw new CleaningPhotoWorkflowError(
      'Caricamento della foto non completato. Controlla la connessione e riprova.', 'photo_workflow_failed', stage,
    )
  }
  throw new Error('Unreachable photo retry state')
}
