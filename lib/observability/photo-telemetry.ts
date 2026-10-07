import * as Sentry from '@sentry/nextjs'
import type { CleaningPhotoPhase } from '@/lib/types/service-order-photos'

export type PhotoDecoder = 'bitmap_oriented' | 'bitmap_default' | 'html_image'
export type PhotoProgress = {
  stage: 'reservation' | 'upload' | 'finalization'
  attempt: 1 | 2
  uploadAttempt?: 1 | 2
  variant?: 'display' | 'thumbnail'
  retryResult: 'not_needed' | 'retrying' | 'verified' | 'reconciled' | 'recovered' | 'failed'
  recovered: boolean
}
const failureCodes = new Set([
  'decode_failed', 'source_pixels_exceeded', 'canvas_unavailable', 'draw_failed',
  'encode_null', 'encode_type_mismatch', 'size_limit_unreachable', 'photo_variant_missing',
  'photo_content_invalid', 'photo_storage_unavailable', 'photo_cleanup_failed',
  'photo_cleanup_manual_attention', 'photo_cleanup_unconfirmed', 'photo_upload_rejected',
  'photo_duplicate_reservation', 'photo_reservation_mismatch', 'photo_workflow_failed',
  'photo_limit_reached',
])
function decoderTag(decoder?: string) {
  return decoder === 'bitmap_oriented' || decoder === 'bitmap_default' || decoder === 'html_image'
    ? decoder : 'unknown'
}
export function photoProgressTags(progress: PhotoProgress) {
  return {
    stage: progress.stage, attempt: String(progress.attempt),
    upload_attempt: String(progress.uploadAttempt ?? 1),
    retry_result: progress.retryResult, recovered: String(progress.recovered),
    ...(progress.variant ? { variant: progress.variant } : {}),
  }
}
export function recordPhotoProgress(progress: PhotoProgress, phase: CleaningPhotoPhase, decoder?: PhotoDecoder) {
  try {
    Sentry.addBreadcrumb({ category: 'cleaning-photo.upload', level: 'info', data: {
      ...photoProgressTags(progress), phase, decoder: decoderTag(decoder),
    } })
  } catch { /* Reporting must never change upload/recovery behavior. */ }
}

export function capturePhotoFailure(
  error: unknown,
  source: { type: string; size: number },
  phase: CleaningPhotoPhase,
  stage: 'processing' | PhotoProgress['stage'],
  progress?: PhotoProgress,
  decoder?: PhotoDecoder,
) {
  const coded = error as { code?: string; details?: Record<string, unknown> } | null
  const code = coded?.code && failureCodes.has(coded.code) ? coded.code : 'workflow_error'
  // Never send arbitrary backend/decoder messages, file names or error objects.
  const exception = new Error(`Cleaning photo failure: ${code}`)
  exception.name = stage === 'processing' ? 'PhotoProcessingError' : 'CleaningPhotoWorkflowError'
  if (error instanceof Error && error.stack) {
    exception.stack = `${exception.name}: ${exception.message}\n${error.stack.split('\n').slice(1).join('\n')}`
  }
  try {
    Sentry.captureException(exception, {
      level: 'error',
      tags: {
        area: 'cleaning-photo', phase, failure_code: code,
        decoder: decoderTag(decoder ?? (typeof coded?.details?.decoder === 'string' ? coded.details.decoder : undefined)),
        source_content_type: ['image/jpeg', 'image/png', 'image/webp'].includes(source.type) ? source.type : 'other',
        source_size_bucket: source.size <= 2 * 1024 * 1024 ? 'lte_2mb' : source.size <= 8 * 1024 * 1024 ? '2mb_to_8mb' : 'gt_8mb',
        ...photoProgressTags(progress ?? { stage: 'reservation', attempt: 1, retryResult: 'failed', recovered: false }),
        // Processing does not have an upload cycle; its attempt counts decoder paths.
        stage,
        attempt: stage === 'processing' ? String(Math.min(3, Math.max(1, Number(coded?.details?.decoderAttempts) || 1))) : String(progress?.attempt ?? 1),
        retry_result: 'failed', recovered: 'false',
      },
      extra: coded?.details,
    })
  } catch { /* The user still receives the actionable original error. */ }
}
