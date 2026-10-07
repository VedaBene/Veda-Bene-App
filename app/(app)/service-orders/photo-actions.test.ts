import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { CleaningPhotoLimitError } from '@/lib/types/cleaning-photo-errors'
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
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/server/data-access/viewer', () => ({
  getCurrentViewer: mocks.getCurrentViewer,
}))

vi.mock('@/lib/server/features', () => ({
  isCleaningPhotosEnabled: mocks.isCleaningPhotosEnabled,
}))

// Exercise the real action logger: expected returns must not capture, while
// unexpected thrown failures must still be monitored exactly once.
vi.mock('@sentry/nextjs', async importOriginal => {
  const actual = await importOriginal<typeof import('@sentry/nextjs')>()
  return {
    init: actual.init,
    withIsolationScope: actual.withIsolationScope,
    getIsolationScope: actual.getIsolationScope,
    setUser: actual.setUser,
    captureException: vi.fn(),
  }
})

vi.mock('@/lib/server/service-order-photos', () => ({
  reserveCleaningPhotoUpload: mocks.reserveCleaningPhotoUpload,
  finalizeCleaningPhotoUpload: mocks.finalizeCleaningPhotoUpload,
  abortCleaningPhotoUpload: mocks.abortCleaningPhotoUpload,
  cancelCleaningPhotoUpload: vi.fn(),
  deleteCleaningPhoto: vi.fn(),
}))

describe('cleaning photo server actions', () => {
  beforeAll(() => { Sentry.init({ enabled: false, defaultIntegrations: [] }) })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isCleaningPhotosEnabled.mockReturnValue(true)
    mocks.getCurrentViewer.mockResolvedValue({
      supabase: { id: 'server-client' },
      viewer: { userId: 'viewer-id', role: 'limpeza' },
    })
  })

  it('returns the photo limit as an expected, user-facing failure', async () => {
    mocks.reserveCleaningPhotoUpload.mockRejectedValue(new CleaningPhotoLimitError())

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
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('keeps unexpected failures as exceptions for internal monitoring', async () => {
    mocks.reserveCleaningPhotoUpload.mockRejectedValue(new Error('unexpected storage failure'))

    await expect(reserveCleaningPhoto(
      '86f05f4c-cbdd-47ad-b91d-f4a47c957ae7',
      'after',
      '57dc7877-faf0-42f9-8091-fc966b4a7744',
      'image/jpeg',
    )).rejects.toThrow('unexpected storage failure')
    expect(Sentry.captureException).toHaveBeenCalledOnce()
  })

  it.each([
    new Error(CLEANING_PHOTO_LIMIT_MESSAGE),
    Object.assign(new Error(CLEANING_PHOTO_LIMIT_MESSAGE), { code: 'unknown_code' }),
    Object.assign(new Error('Sem permissão'), { code: 'unauthorized' }),
  ])('does not suppress an uncoded, unknown or authorization failure (%s)', async error => {
    mocks.reserveCleaningPhotoUpload.mockRejectedValueOnce(error)
    await expect(reserveCleaningPhoto('order', 'before', 'photo', 'image/jpeg')).rejects.toBe(error)
    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(error, expect.any(Object))
  })

  it('never converts an authentication failure into a limit response', async () => {
    const error = new Error('Sessione scaduta')
    mocks.getCurrentViewer.mockRejectedValueOnce(error)
    await expect(reserveCleaningPhoto('order', 'before', 'photo', 'image/jpeg')).rejects.toBe(error)
    expect(mocks.reserveCleaningPhotoUpload).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(error, expect.any(Object))
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

  it('correlates server failures with the authenticated UUID and restores the outside scope', async () => {
    const id = '12345678-1234-4123-8123-123456789abc'
    const outside = Sentry.getIsolationScope().getUser()
    mocks.getCurrentViewer.mockResolvedValue({ supabase: {}, viewer: { userId: id, role: 'limpeza' } })
    mocks.reserveCleaningPhotoUpload.mockImplementationOnce(async () => {
      expect(Sentry.getIsolationScope().getUser()).toEqual({ id })
      expect(Sentry.getIsolationScope().getScopeData().tags.area).toBe('cleaning-photo')
      throw new Error('synthetic failure')
    })
    await expect(reserveCleaningPhoto('order', 'before', 'photo', 'image/jpeg')).rejects.toThrow('synthetic failure')
    expect(Sentry.getIsolationScope().getUser()).toEqual(outside)
  })

  it('keeps different users isolated across concurrent server requests', async () => {
    const ids = ['12345678-1234-4123-8123-123456789abc', 'abcdef12-1234-4123-8123-123456789abc']
    mocks.getCurrentViewer.mockResolvedValueOnce({ supabase: {}, viewer: { userId: ids[0], role: 'limpeza' } })
      .mockResolvedValueOnce({ supabase: {}, viewer: { userId: ids[1], role: 'limpeza' } })
    let finish!: () => void
    mocks.finalizeCleaningPhotoUpload.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { finish = resolve })
      expect(Sentry.getIsolationScope().getUser()).toEqual({ id: ids[0] })
      return { success: true, photoId: 'first' }
    }).mockImplementationOnce(async () => {
      expect(Sentry.getIsolationScope().getUser()).toEqual({ id: ids[1] })
      finish()
      return { success: true, photoId: 'second' }
    })
    await Promise.all([finalizeCleaningPhoto('first'), finalizeCleaningPhoto('second')])
    expect(Sentry.getIsolationScope().getUser()).not.toEqual({ id: ids[0] })
    expect(Sentry.getIsolationScope().getUser()).not.toEqual({ id: ids[1] })
  })
})
