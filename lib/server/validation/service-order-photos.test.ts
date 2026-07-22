import { describe, expect, it } from 'vitest'
import { cleaningPhotoIdsSchema, reserveCleaningPhotoSchema } from './service-order-photos'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const PHOTO_ID = '22222222-2222-4222-8222-222222222222'

describe('cleaning photo validation', () => {
  it('accepts a bounded reservation with a server-recognized phase', () => {
    expect(reserveCleaningPhotoSchema.safeParse({
      serviceOrderId: ORDER_ID,
      phase: 'before',
      clientUploadId: PHOTO_ID,
    }).success).toBe(true)
  })

  it('rejects invalid phases and duplicate photo identifiers', () => {
    expect(reserveCleaningPhotoSchema.safeParse({
      serviceOrderId: ORDER_ID,
      phase: 'during',
      clientUploadId: PHOTO_ID,
    }).success).toBe(false)
    expect(cleaningPhotoIdsSchema.safeParse([PHOTO_ID, PHOTO_ID]).success).toBe(false)
  })

  it('rejects more than eight photos', () => {
    const ids = Array.from({ length: 9 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    )
    expect(cleaningPhotoIdsSchema.safeParse(ids).success).toBe(false)
  })
})
