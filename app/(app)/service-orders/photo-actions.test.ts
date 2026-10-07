import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLEANING_PHOTO_LIMIT_CODE,
  CLEANING_PHOTO_LIMIT_MESSAGE,
} from '@/lib/types/service-order-photos'
import { abortCleaningPhoto, finalizeCleaningPhoto, reserveCleaningPhoto } from './photo-actions'

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  isCleaningPhotosEnabled: vi.fn(),
  reserveCleaningPhotoUpload: vi.fn(),
  finalizeCleaningPhotoUpload: vi.fn(),
  abortCleaningPhotoUpload: vi.fn(),
  withLogging: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/server/data-access/viewer', () => ({
  getCurrentViewer: mocks.getCurrentViewer,
}))

vi.mock('@/lib/server/features', () => ({
  isCleaningPhotosEnabled: mocks.isCleaningPhotosEnabled,
}))

vi.mock('@/lib/server/logger', () => ({
  withLogging: mocks.withLogging,
}))

vi.mock('@/lib/server/service-order-photos', () => ({
  reserveCleaningPhotoUpload: mocks.reserveCleaningPhotoUpload,
  finalizeCleaningPhotoUpload: mocks.finalizeCleaningPhotoUpload,
  abortCleaningPhotoUpload: mocks.abortCleaningPhotoUpload,
  cancelCleaningPhotoUpload: vi.fn(),
  deleteCleaningPhoto: vi.fn(),
}))

describe('cleaning photo server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isCleaningPhotosEnabled.mockReturnValue(true)
    mocks.getCurrentViewer.mockResolvedValue({
      supabase: { id: 'server-client' },
      viewer: { userId: 'viewer-id', role: 'limpeza' },
    })
  })

  it('returns the photo limit as an expected, user-facing failure', async () => {
    mocks.reserveCleaningPhotoUpload.mockRejectedValue(new Error(CLEANING_PHOTO_LIMIT_MESSAGE))

    await expect(reserveCleaningPhoto(
      '86f05f4c-cbdd-47ad-b91d-f4a47c957ae7',
      'after',
      '57dc7877-faf0-42f9-8091-fc966b4a7744',
      'image/jpeg',
    )).resolves.toEqual({
      success: false,
      code: CLEANING_PHOTO_LIMIT_CODE,
      error: CLEANING_PHOTO_LIMIT_MESSAGE,
    })
  })

  it('keeps unexpected failures as exceptions for internal monitoring', async () => {
    mocks.reserveCleaningPhotoUpload.mockRejectedValue(new Error('unexpected storage failure'))

    await expect(reserveCleaningPhoto(
      '86f05f4c-cbdd-47ad-b91d-f4a47c957ae7',
      'after',
      '57dc7877-faf0-42f9-8091-fc966b4a7744',
      'image/jpeg',
    )).rejects.toThrow('unexpected storage failure')
  })

  it('preserves the typed finalization result over the server-action boundary', async () => {
    const failure = { success: false, code: 'photo_variant_missing', error: 'Variante assente' }
    mocks.finalizeCleaningPhotoUpload.mockResolvedValue(failure)
    await expect(finalizeCleaningPhoto('synthetic-id')).resolves.toEqual(failure)
    expect(mocks.finalizeCleaningPhotoUpload).toHaveBeenCalledWith(
      { id: 'server-client' }, { userId: 'viewer-id', role: 'limpeza' }, { photoId: 'synthetic-id' },
    )
  })

  it('passes session-derived identity to pending-only cleanup', async () => {
    mocks.abortCleaningPhotoUpload.mockResolvedValue({ success: true, status: 'ready', photoId: 'synthetic-id' })
    await expect(abortCleaningPhoto('synthetic-id')).resolves.toMatchObject({ status: 'ready' })
    expect(mocks.abortCleaningPhotoUpload).toHaveBeenCalledWith({ userId: 'viewer-id', role: 'limpeza' }, 'synthetic-id')
  })

  it('does not clean or finalize when the feature is disabled', async () => {
    mocks.isCleaningPhotosEnabled.mockReturnValue(false)
    await expect(abortCleaningPhoto('synthetic-id')).rejects.toThrow('non è attiva')
    await expect(finalizeCleaningPhoto('synthetic-id')).rejects.toThrow('non è attiva')
    expect(mocks.abortCleaningPhotoUpload).not.toHaveBeenCalled()
    expect(mocks.finalizeCleaningPhotoUpload).not.toHaveBeenCalled()
  })
})
