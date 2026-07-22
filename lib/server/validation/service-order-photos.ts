import { z } from 'zod'
import { uuidSchema } from './contracts'

export const cleaningPhotoPhaseSchema = z.enum(['before', 'after'])

export const reserveCleaningPhotoSchema = z.object({
  serviceOrderId: uuidSchema,
  phase: cleaningPhotoPhaseSchema,
  clientUploadId: uuidSchema,
})

export const finalizeCleaningPhotoSchema = z.object({
  photoId: uuidSchema,
})

export const cleaningPhotoIdsSchema = z
  .array(uuidSchema)
  .max(8, 'Massimo 8 foto per fase')
  .refine(ids => new Set(ids).size === ids.length, 'Le foto non possono essere duplicate')
