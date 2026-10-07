import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceOrderPhotoRecord } from '@/lib/types/service-order-photos'

const mocks = vi.hoisted(() => ({ client: vi.fn(), info: vi.fn(), download: vi.fn(), remove: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.client }))
import { deletePendingPhotoRecordAndObjects, inspectImageObject } from './service-order-photo-storage'
import { abortCleaningPhotoUpload } from '@/lib/server/service-order-photos'
import { uploadPreparedCleaningPhoto } from '@/lib/client/cleaning-photo-upload'
import type { Viewer } from '@/lib/server/data-access/viewer'

const record = { id: 'synthetic-id', status: 'pending', display_path: 'synthetic/display.webp', thumbnail_path: 'synthetic/thumb.webp' } as ServiceOrderPhotoRecord
const query = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder')
  query.delete.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: record, error: null })
  query.insert.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.client.mockReturnValue({ from: () => query, storage: { from: () => ({ info: mocks.info, download: mocks.download, remove: mocks.remove }) } })
})
afterEach(() => vi.unstubAllEnvs())

function concurrentCleanupHarness() {
  const viewer = { userId: 'synthetic-owner', role: 'limpeza' } as Viewer
  const original = { ...record, id: '22222222-2222-4222-8222-222222222222', uploaded_by: viewer.userId }
  let row: ServiceOrderPhotoRecord | null = original
  const objects = new Set([original.display_path, original.thumbnail_path])
  let startRemoval!: () => void
  const removalStarted = new Promise<void>(resolve => { startRemoval = resolve })
  let finishRemoval!: (result: { error: { status: number } | null }) => void
  const removalResult = new Promise<{ error: { status: number } | null }>(resolve => { finishRemoval = resolve })
  mocks.client.mockReturnValue({
    from: () => {
      let deleting = false
      const filters = new Map<string, string>()
      const table = {
        delete: () => { deleting = true; return table },
        select: () => table,
        eq: (field: string, value: string) => { filters.set(field, value); return table },
        maybeSingle: async () => {
          const matched = row && [...filters].every(([field, value]) => row![field as keyof ServiceOrderPhotoRecord] === value)
          const data = matched ? { ...row! } : null
          if (deleting && matched) row = null
          return { data, error: null }
        },
        insert: async (restored: ServiceOrderPhotoRecord) => { row = { ...restored }; return { error: null } },
      }
      return table
    },
    storage: { from: () => ({ remove: mocks.remove }) },
  })
  mocks.remove.mockImplementation(async (paths: string[]) => {
    startRemoval()
    const result = await removalResult
    if (!result.error) paths.forEach(path => objects.delete(path))
    return result
  })
  return { viewer, original, objects, removalStarted, finishRemoval, getRow: () => row }
}

describe('concurrent cleanup confirmation regression', () => {
  it('never confirms a second abort while Storage is active and the first abort later restores pending', async () => {
    const h = concurrentCleanupHarness()
    const first = abortCleaningPhotoUpload(h.viewer, h.original.id)
    await h.removalStarted
    expect(h.getRow()).toBeNull()
    const second = await abortCleaningPhotoUpload(h.viewer, h.original.id)
    const objectsBeforeRemoval = h.objects.size
    h.finishRemoval({ error: { status: 503 } })
    const firstResult = await first
    expect(second).toMatchObject({ success: false, code: 'photo_cleanup_manual_attention' })
    expect(objectsBeforeRemoval).toBe(2)
    expect(firstResult).toMatchObject({ success: false, code: 'photo_cleanup_failed' })
    expect(h.getRow()).toEqual(h.original)
    expect(h.objects.size).toBe(2)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
  })

  it('never confirms a losing conditional claim from a stale pending snapshot', async () => {
    const h = concurrentCleanupHarness()
    const first = deletePendingPhotoRecordAndObjects(h.original).catch(error => error)
    await h.removalStarted
    const second = await deletePendingPhotoRecordAndObjects(h.original).catch(error => error)
    h.finishRemoval({ error: { status: 503 } })
    expect(await first).toMatchObject({ code: 'photo_cleanup_failed' })
    expect(second).toMatchObject({ code: 'photo_cleanup_manual_attention' })
    expect(h.getRow()).toEqual(h.original)
    expect(h.objects.size).toBe(2)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('blocks a fresh client reservation while cleanup is active (Storage later succeeds: %s)', async succeeds => {
    const h = concurrentCleanupHarness()
    const first = abortCleaningPhotoUpload(h.viewer, h.original.id)
    await h.removalStarted
    const deps = {
      reserve: vi.fn(), upload: vi.fn(), finalize: vi.fn(),
      abort: (id: string) => abortCleaningPhotoUpload(h.viewer, id),
      createId: () => '33333333-3333-4333-8333-333333333333', sleep: vi.fn(), onReservation: vi.fn(),
    }
    const processed = {
      display: new Blob(['synthetic display'], { type: 'image/webp' }),
      thumbnail: new Blob(['synthetic thumb'], { type: 'image/webp' }),
      contentType: 'image/webp' as const, width: 16, height: 8,
    }
    const retry = await uploadPreparedCleaningPhoto(processed, deps, h.original.id).catch(error => error)
    h.finishRemoval({ error: succeeds ? null : { status: 503 } })
    const firstResult = await first
    expect(retry).toMatchObject({ code: 'photo_cleanup_manual_attention', pendingPhotoId: h.original.id })
    expect(deps.reserve).not.toHaveBeenCalled()
    expect(deps.upload).not.toHaveBeenCalled()
    expect(deps.onReservation).not.toHaveBeenCalled()
    expect(h.objects.size).toBe(succeeds ? 0 : 2)
    expect(firstResult.success).toBe(succeeds)
    if (succeeds) {
      // Even after a lost successful response, missing metadata alone cannot
      // prove that another caller completed Storage cleanup.
      await expect(abortCleaningPhotoUpload(h.viewer, h.original.id)).resolves.toMatchObject({
        success: false, code: 'photo_cleanup_manual_attention',
      })
    } else {
      expect(h.getRow()).toEqual(h.original)
    }
  })
})

describe('photo inspection classifies absence conservatively', () => {
  it.each([404, 403, 500, 503])('classifies HTTP %i without confusing authorization/unavailability with missing bytes', async status => {
    mocks.info.mockResolvedValue({ data: null, error: { status } })
    mocks.download.mockResolvedValue({ data: null, error: { status } })
    await expect(inspectImageObject(record.display_path, 'image/webp', { maxBytes: 2048, maxDimension: 1920 }))
      .rejects.toMatchObject({ code: status === 404 ? 'photo_variant_missing' : 'photo_storage_unavailable' })
  })
  it('does not claim absence for a 404 combined with a failed verification request', async () => {
    mocks.info.mockResolvedValue({ data: null, error: { status: 404 } })
    mocks.download.mockResolvedValue({ data: null, error: { status: 503 } })
    await expect(inspectImageObject(record.display_path, 'image/webp', { maxBytes: 2048, maxDimension: 1920 }))
      .rejects.toMatchObject({ code: 'photo_storage_unavailable' })
  })
  it('does not treat an empty response as proven missing', async () => {
    mocks.info.mockResolvedValue({ data: null, error: null })
    mocks.download.mockResolvedValue({ data: null, error: null })
    await expect(inspectImageObject(record.display_path, 'image/webp', { maxBytes: 2048, maxDimension: 1920 }))
      .rejects.toMatchObject({ code: 'photo_storage_unavailable' })
  })
})

describe('atomic pending-only cleanup claim', () => {
  it('claims only pending before removing the exact two immutable objects', async () => {
    expect(await deletePendingPhotoRecordAndObjects(record)).toBe('removed')
    expect(query.eq).toHaveBeenCalledWith('status', 'pending')
    expect(query.eq).toHaveBeenCalledWith('id', record.id)
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([record.display_path, record.thumbnail_path])
    expect(query.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0])
    expect(query.insert).not.toHaveBeenCalled()
  })
  it('never removes objects when a concurrent finalization already won the row', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...record, status: 'ready' }, error: null })
    expect(await deletePendingPhotoRecordAndObjects(record)).toBe('ready')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(query.insert).not.toHaveBeenCalled()
  })
  it('does not infer completed object removal from an absent row', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toMatchObject({ code: 'photo_cleanup_manual_attention' })
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('does not remove objects if the conditional claim failed', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'synthetic' } })
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toThrow('annullare')
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('requires assistance for a lost conditional DELETE response', async () => {
    query.maybeSingle.mockRejectedValueOnce(new TypeError('synthetic lost response'))
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toMatchObject({ code: 'photo_cleanup_manual_attention' })
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('never reports an unclaimed pending row as cleaned', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: record, error: null })
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toMatchObject({ code: 'photo_cleanup_failed' })
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('preserves the original pending metadata/paths if object removal fails', async () => {
    mocks.remove.mockResolvedValue({ error: { status: 503 } })
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toThrow('Pulizia della foto non completata')
    expect(query.insert).toHaveBeenCalledExactlyOnceWith(record)
    expect(record.status).toBe('pending')
  })
  it('reports an explicit assistance error if removal and metadata compensation both fail', async () => {
    mocks.remove.mockResolvedValue({ error: { status: 503 } })
    query.insert.mockResolvedValue({ error: { message: 'synthetic' } })
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toThrow('Contatta l’assistenza')
  })
  it('also preserves metadata when the Storage request rejects instead of returning an error', async () => {
    mocks.remove.mockRejectedValue(new TypeError('synthetic offline'))
    await expect(deletePendingPhotoRecordAndObjects(record)).rejects.toMatchObject({ code: 'photo_cleanup_failed' })
    expect(query.insert).toHaveBeenCalledExactlyOnceWith(record)
  })
})
