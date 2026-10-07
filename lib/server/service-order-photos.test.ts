import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseServerClient, Viewer } from './data-access/viewer'
import { CLEANING_PHOTO_LIMIT_CODE, CLEANING_PHOTO_LIMIT_MESSAGE, MAX_CLEANING_PHOTOS } from '@/lib/types/service-order-photos'
import { CleaningPhotoLimitError } from '@/lib/types/cleaning-photo-errors'

const mocks = vi.hoisted(() => ({
  find: vi.fn(), inspect: vi.fn(), ready: vi.fn(), remove: vi.fn(), removePending: vi.fn(),
  list: vi.fn(), reserve: vi.fn(), tokens: vi.fn(),
  InspectionError: class extends Error {
    constructor(readonly code: string, message: string) { super(message) }
  },
  CleanupError: class extends Error {
    constructor(readonly code: string, message: string) { super(message) }
  },
}))
vi.mock('@/lib/server/storage/service-order-photo-storage', () => ({
  findPhotoById: mocks.find, inspectImageObject: mocks.inspect, markPhotoReady: mocks.ready,
  deletePhotoRecordAndObjects: mocks.remove, deletePendingPhotoRecordAndObjects: mocks.removePending,
  PhotoInspectionError: mocks.InspectionError, MAX_DISPLAY_BYTES: 2097152, MAX_THUMBNAIL_BYTES: 524288,
  PhotoCleanupError: mocks.CleanupError,
  listPhotoRecords: mocks.list, reservePhotoRecord: mocks.reserve, createPhotoUploadTokens: mocks.tokens,
}))
import { abortCleaningPhotoUpload, cancelCleaningPhotoUpload, finalizeCleaningPhotoUpload, reserveCleaningPhotoUpload } from './service-order-photos'

const id = '22222222-2222-4222-8222-222222222222'
const viewer = { userId: 'synthetic-owner', role: 'limpeza' } as Viewer
const record = { id, uploaded_by: viewer.userId, status: 'pending', service_order_id: 'synthetic-order',
  cycle_no: 1, phase: 'before', content_type: 'image/webp', display_path: 'display.webp', thumbnail_path: 'thumb.webp' }
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
const supabase = { from: () => query } as unknown as SupabaseServerClient

beforeEach(() => {
  vi.resetAllMocks()
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: 'synthetic-order', cleaning_cycle: 1, status: 'open', started_at: null, completed_at: null } })
  mocks.find.mockResolvedValue({ ...record })
  mocks.inspect.mockResolvedValue({ width: 16, height: 8, size: 100 })
  mocks.ready.mockResolvedValue(undefined)
  mocks.removePending.mockResolvedValue('removed')
})

describe('server photo limit enforcement', () => {
  const input = { serviceOrderId: id, phase: 'before', clientUploadId: id, contentType: 'image/webp' }
  const readyPhotos = Array.from({ length: MAX_CLEANING_PHOTOS }, (_, sort_order) => ({
    ...record, status: 'ready', sort_order,
  }))

  it('rejects a ninth photo by domain code without creating a reservation, tokens or deleting ready photos', async () => {
    mocks.find.mockResolvedValue(null)
    mocks.list.mockResolvedValue(readyPhotos)
    const failure = reserveCleaningPhotoUpload(supabase, viewer, input)
    await expect(failure).rejects.toBeInstanceOf(CleaningPhotoLimitError)
    await expect(failure).rejects.toMatchObject({ code: CLEANING_PHOTO_LIMIT_CODE, message: CLEANING_PHOTO_LIMIT_MESSAGE })
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.tokens).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('still permits the eighth photo using the last available slot', async () => {
    mocks.find.mockResolvedValue(null)
    mocks.list.mockResolvedValue(readyPhotos.slice(0, MAX_CLEANING_PHOTOS - 1))
    mocks.reserve.mockResolvedValue(record)
    mocks.tokens.mockResolvedValue({ photoId: id })
    await expect(reserveCleaningPhotoUpload(supabase, viewer, input)).resolves.toEqual({ photoId: id })
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: MAX_CLEANING_PHOTOS - 1 }))
    expect(mocks.tokens).toHaveBeenCalledExactlyOnceWith(record)
  })

  it('checks authorization before querying slots even when all eight are occupied', async () => {
    mocks.list.mockResolvedValue(readyPhotos)
    await expect(reserveCleaningPhotoUpload(supabase, { ...viewer, role: 'cliente' }, input)).rejects.toThrow('Sem permissão')
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})

describe('authoritative photo finalization and pending-only abort', () => {
  it('marks ready only after inspecting both variants with their existing limits', async () => {
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).resolves.toEqual({ success: true, photoId: id })
    expect(mocks.inspect).toHaveBeenNthCalledWith(1, 'display.webp', 'image/webp', { maxBytes: 2097152, maxDimension: 1920 })
    expect(mocks.inspect).toHaveBeenNthCalledWith(2, 'thumb.webp', 'image/webp', { maxBytes: 524288, maxDimension: 480 })
    expect(mocks.ready).toHaveBeenCalledExactlyOnceWith(id, { width: 16, height: 8, displaySizeBytes: 100, thumbnailSizeBytes: 100 })
  })

  it.each(['photo_variant_missing', 'photo_content_invalid', 'photo_storage_unavailable'])('returns serializable %s without publishing or deleting', async code => {
    mocks.inspect.mockRejectedValueOnce(new mocks.InspectionError(code, 'Synthetic failure'))
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).resolves.toEqual({ success: false, code, error: 'Synthetic failure' })
    expect(mocks.ready).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('never publishes when only the thumbnail fails inspection', async () => {
    mocks.inspect.mockResolvedValueOnce({ width: 16, height: 8, size: 100 })
      .mockRejectedValueOnce(new mocks.InspectionError('photo_content_invalid', 'Invalid thumb'))
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).resolves.toMatchObject({ success: false })
    expect(mocks.ready).not.toHaveBeenCalled()
  })

  it('does not delete after an ambiguous ready write', async () => {
    mocks.ready.mockRejectedValueOnce(new Error('synthetic lost DB response'))
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).rejects.toThrow('lost DB response')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('ready finalization and automatic abort are idempotent and preserve objects', async () => {
    mocks.find.mockResolvedValue({ ...record, status: 'ready' })
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).resolves.toEqual({ success: true, photoId: id })
    await expect(abortCleaningPhotoUpload(viewer, id)).resolves.toEqual({ success: true, status: 'ready', photoId: id })
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('cleans owned pending reservations through the conditional helper', async () => {
    await expect(abortCleaningPhotoUpload(viewer, id)).resolves.toEqual({ success: true, status: 'removed', photoId: id })
    expect(mocks.removePending).toHaveBeenCalledExactlyOnceWith(record)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('reports a concurrent ready winner instead of deleting it', async () => {
    mocks.removePending.mockResolvedValue('ready')
    await expect(abortCleaningPhotoUpload(viewer, id)).resolves.toMatchObject({ status: 'ready' })
  })

  it('does not report successful cleanup when the conditional helper fails', async () => {
    mocks.removePending.mockRejectedValue(new Error('cleanup failed'))
    await expect(abortCleaningPhotoUpload(viewer, id)).rejects.toThrow('cleanup failed')
  })

  it('returns a typed cleanup failure instead of losing it in production error serialization', async () => {
    mocks.removePending.mockRejectedValue(new mocks.CleanupError('photo_cleanup_manual_attention', 'Assistenza necessaria'))
    await expect(abortCleaningPhotoUpload(viewer, id)).resolves.toEqual({ success: false, code: 'photo_cleanup_manual_attention', error: 'Assistenza necessaria' })
  })

  it('rejects invalid IDs, a foreign owner and an unauthorized finalizer', async () => {
    await expect(abortCleaningPhotoUpload(viewer, 'invalid')).rejects.toThrow()
    mocks.find.mockResolvedValue({ ...record, uploaded_by: 'other-owner' })
    await expect(abortCleaningPhotoUpload(viewer, id)).rejects.toThrow('Sem permissão')
    await expect(finalizeCleaningPhotoUpload(supabase, viewer, { photoId: id })).rejects.toThrow('non autorizzata')
    await expect(finalizeCleaningPhotoUpload(supabase, { ...viewer, role: 'cliente' }, { photoId: id })).rejects.toThrow('Sem permissão')
    expect(mocks.removePending).not.toHaveBeenCalled()
    expect(mocks.ready).not.toHaveBeenCalled()
  })

  it('does not confirm Storage cleanup from missing reservation metadata', async () => {
    mocks.find.mockResolvedValue(null)
    await expect(abortCleaningPhotoUpload(viewer, id)).resolves.toMatchObject({ success: false, code: 'photo_cleanup_manual_attention' })
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('preserves the existing explicit removal of a ready photo', async () => {
    mocks.find.mockResolvedValue({ ...record, status: 'ready' })
    await cancelCleaningPhotoUpload(supabase, viewer, id)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.removePending).not.toHaveBeenCalled()
  })
})
