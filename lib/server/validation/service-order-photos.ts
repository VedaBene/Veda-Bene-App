import { z } from 'zod'
import { CLEANING_PHOTO_CONTENT_TYPES } from '@/lib/types/service-order-photos'
import { uuidSchema } from './contracts'

export const cleaningPhotoPhaseSchema = z.enum(['before', 'after'])
export const cleaningPhotoContentTypeSchema = z.enum(CLEANING_PHOTO_CONTENT_TYPES)

export const reserveCleaningPhotoSchema = z.object({
  serviceOrderId: uuidSchema,
  phase: cleaningPhotoPhaseSchema,
  clientUploadId: uuidSchema,
  contentType: cleaningPhotoContentTypeSchema,
})

export const finalizeCleaningPhotoSchema = z.object({
  photoId: uuidSchema,
})

export const cleaningPhotoIdsSchema = z
  .array(uuidSchema)
  .max(8, 'Massimo 8 foto per fase')
  .refine(ids => new Set(ids).size === ids.length, 'Le foto non possono essere duplicate')
