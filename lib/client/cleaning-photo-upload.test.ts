import { describe, expect, it, vi } from 'vitest'
import { classifyPhotoUploadFailure, uploadPreparedCleaningPhoto } from './cleaning-photo-upload'
import type { ProcessedCleaningPhoto } from './image-processing'
import type { AbortCleaningPhotoResult, FinalizeCleaningPhotoResult } from '@/lib/types/service-order-photos'

const processed: ProcessedCleaningPhoto = {
  display: new Blob(['display'], { type: 'image/webp' }),
  thumbnail: new Blob(['thumb'], { type: 'image/webp' }),
  contentType: 'image/webp', width: 1920, height: 1080,
}
const missing = { success: false as const, code: 'photo_variant_missing' as const, error: 'Variante assente. Riprova.' }
function harness() {
  let counter = 0
  const records = new Map<string, { status: 'pending' | 'ready'; objects: Set<string> }>()
  const deps = {
    reserve: vi.fn(async (id: string) => {
      expect(records.has(id)).toBe(false)
      records.set(id, { status: 'pending', objects: new Set() })
      return { success: true as const, upload: { photoId: id, contentType: 'image/webp' as const,
        display: { path: `${id}/display`, token: 'synthetic' }, thumbnail: { path: `${id}/thumb`, token: 'synthetic' } } }
    }),
    upload: vi.fn<(variant: { path: string; token: string }, blob: Blob) => Promise<{ error: unknown }>>(async ({ path }) => {
      const [id, variant] = path.split('/')
      records.get(id)!.objects.add(variant)
      return { error: null }
    }),
    finalize: vi.fn(async (id: string): Promise<FinalizeCleaningPhotoResult> => {
      const row = records.get(id)!
      if (row.objects.size !== 2) return missing
      row.status = 'ready'
      return { success: true as const, photoId: id }
    }),
    abort: vi.fn(async (id: string): Promise<AbortCleaningPhotoResult> => {
      if (records.get(id)?.status === 'ready') return { success: true as const, status: 'ready' as const, photoId: id }
      records.delete(id)
      return { success: true as const, status: 'removed' as const, photoId: id }
    }),
    createId: () => `photo-${++counter}`, sleep: vi.fn<(ms: number) => Promise<void>>(async () => {}), onReservation: vi.fn(),
  }
  return { deps, records }
}

describe('bounded immutable photo upload', () => {
  it('sends display then thumbnail, validates both and returns one ready ID', async () => {
    const { deps, records } = harness()
    expect(await uploadPreparedCleaningPhoto(processed, deps)).toBe('photo-1')
    expect(deps.upload.mock.calls.map(([variant]) => variant.path)).toEqual(['photo-1/display', 'photo-1/thumb'])
    expect(records.get('photo-1')).toEqual({ status: 'ready', objects: new Set(['display', 'thumb']) })
    expect(deps.abort).not.toHaveBeenCalled()
    expect(deps.sleep).not.toHaveBeenCalled()
  })

  it('waits for the active request instead of starting another on a timer', async () => {
    const { deps } = harness()
    let settle!: () => void
    deps.upload.mockImplementationOnce(() => new Promise(resolve => { settle = () => resolve({ error: null }) }))
    const result = uploadPreparedCleaningPhoto(processed, deps)
    await Promise.resolve(); await Promise.resolve()
    expect(deps.upload).toHaveBeenCalledTimes(1)
    expect(deps.sleep).not.toHaveBeenCalled()
    expect(deps.finalize).not.toHaveBeenCalled()
    settle()
    await result
    expect(deps.upload).toHaveBeenCalledTimes(4) // first display was absent; one complete retry.
  })

  it('accepts ambiguous responses when both immutable objects arrived', async () => {
    const { deps } = harness()
    const send = deps.upload.getMockImplementation()!
    deps.upload.mockImplementation(async (variant, blob) => {
      await send(variant, blob)
      return { error: new TypeError('synthetic lost response') }
    })
    expect(await uploadPreparedCleaningPhoto(processed, deps)).toBe('photo-1')
    expect(deps.upload).toHaveBeenCalledTimes(2)
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    expect(deps.abort).not.toHaveBeenCalled()
  })

  it('cleans a missing variant, retries once with new paths and keeps no orphan or duplicate', async () => {
    const { deps, records } = harness()
    const send = deps.upload.getMockImplementation()!
    deps.upload.mockImplementation(async (variant, blob) => {
      if (variant.path === 'photo-1/thumb') return { error: new TypeError('synthetic disconnected') }
      return send(variant, blob)
    })
    expect(await uploadPreparedCleaningPhoto(processed, deps)).toBe('photo-2')
    expect(deps.abort).toHaveBeenCalledExactlyOnceWith('photo-1')
    expect(deps.reserve.mock.calls.map(([id]) => id)).toEqual(['photo-1', 'photo-2'])
    expect(deps.upload.mock.calls.map(([variant]) => variant.path)).toEqual(['photo-1/display', 'photo-1/thumb', 'photo-2/display', 'photo-2/thumb'])
    expect([...records.keys()]).toEqual(['photo-2'])
    expect(records.get('photo-2')?.status).toBe('ready')
    expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(400)
  })

  it('ends after two missing-variant cycles and cleans both reservations', async () => {
    const { deps, records } = harness()
    deps.upload.mockResolvedValue({ error: new TypeError('synthetic offline') })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_variant_missing', pendingPhotoId: undefined })
    expect(deps.reserve).toHaveBeenCalledTimes(2)
    expect(deps.upload).toHaveBeenCalledTimes(4)
    expect(deps.abort).toHaveBeenCalledTimes(2)
    expect(records.size).toBe(0)
  })

  it.each([400, 401, 403, 413, 415])('does not retry a definitive HTTP %i rejection', async status => {
    const { deps, records } = harness()
    deps.upload.mockResolvedValue({ error: { status } })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_upload_rejected' })
    expect(deps.upload).toHaveBeenCalledTimes(1)
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    expect(deps.finalize).not.toHaveBeenCalled()
    expect(deps.sleep).not.toHaveBeenCalled()
    expect(records.size).toBe(0)
  })

  it('retries a transient PUT only once with backoff and never overwrites', async () => {
    const { deps } = harness()
    deps.upload.mockResolvedValueOnce({ error: { status: 503 } })
    expect(await uploadPreparedCleaningPhoto(processed, deps)).toBe('photo-1')
    expect(deps.upload).toHaveBeenCalledTimes(3)
    expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(400)
  })

  it('bounds all transient retries and complete cycles', async () => {
    const { deps, records } = harness()
    deps.upload.mockResolvedValue({ error: { status: 503 } })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_variant_missing' })
    expect(deps.upload).toHaveBeenCalledTimes(8)
    expect(deps.reserve).toHaveBeenCalledTimes(2)
    expect(records.size).toBe(0)
  })

  it.each(['photo_content_invalid', 'photo_storage_unavailable'] as const)('does not repeat the cycle for %s', async code => {
    const { deps, records } = harness()
    deps.finalize.mockResolvedValueOnce({ success: false, code, error: 'Verifica fallita' })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code })
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    expect(records.size).toBe(0)
  })

  it('reconciles a lost finalization response without deleting ready or repeating upload', async () => {
    const { deps, records } = harness()
    const finalize = deps.finalize.getMockImplementation()!
    deps.finalize.mockImplementationOnce(async id => { await finalize(id); throw new TypeError('lost confirmation') })
    expect(await uploadPreparedCleaningPhoto(processed, deps)).toBe('photo-1')
    expect(records.get('photo-1')?.status).toBe('ready')
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    expect(deps.upload).toHaveBeenCalledTimes(2)
  })

  it('does not retry authorization/validation exceptions from reservation or finalization', async () => {
    for (const stage of ['reserve', 'finalize'] as const) {
      const { deps, records } = harness()
      deps[stage].mockRejectedValueOnce(new Error('not authorized'))
      await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_workflow_failed' })
      expect(deps.reserve).toHaveBeenCalledTimes(1)
      expect(records.size).toBe(0)
    }
  })

  it('retains an unconfirmed reservation and blocks a new cycle when cleanup fails', async () => {
    const { deps, records } = harness()
    deps.upload.mockResolvedValue({ error: { status: 403 } })
    deps.abort.mockRejectedValueOnce(new TypeError('offline'))
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_cleanup_unconfirmed', pendingPhotoId: 'photo-1' })
    expect(records.get('photo-1')?.status).toBe('pending')
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    deps.upload.mockImplementation(async ({ path }) => {
      const [id, variant] = path.split('/')
      records.get(id)!.objects.add(variant)
      return { error: null }
    })
    expect(await uploadPreparedCleaningPhoto(processed, deps, 'photo-1')).toBe('photo-2')
    expect(records.has('photo-1')).toBe(false)
  })

  it('reuses an already ready previous reservation on manual recovery without uploading again', async () => {
    const { deps, records } = harness()
    records.set('previous', { status: 'ready', objects: new Set(['display', 'thumb']) })
    expect(await uploadPreparedCleaningPhoto(processed, deps, 'previous')).toBe('previous')
    expect(deps.reserve).not.toHaveBeenCalled()
    expect(deps.upload).not.toHaveBeenCalled()
  })

  it('does not create a new reservation while previous cleanup remains unconfirmed', async () => {
    const { deps } = harness()
    deps.abort.mockRejectedValueOnce(new TypeError('offline'))
    await expect(uploadPreparedCleaningPhoto(processed, deps, 'previous')).rejects.toMatchObject({ pendingPhotoId: 'previous' })
    expect(deps.reserve).not.toHaveBeenCalled()
  })

  it('retains typed assistance errors and does not repeat the cycle', async () => {
    const { deps } = harness()
    deps.finalize.mockResolvedValueOnce(missing)
    deps.abort.mockResolvedValueOnce({ success: false, code: 'photo_cleanup_manual_attention', error: 'Contatta assistenza' })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_cleanup_manual_attention', pendingPhotoId: 'photo-1', message: 'Contatta assistenza' })
    expect(deps.reserve).toHaveBeenCalledTimes(1)
  })

  it('refuses a repeated reservation ID before touching an immutable path again', async () => {
    const { deps, records } = harness()
    deps.createId = () => 'same-id'
    deps.upload.mockResolvedValue({ error: new TypeError('offline') })
    await expect(uploadPreparedCleaningPhoto(processed, deps)).rejects.toMatchObject({ code: 'photo_duplicate_reservation' })
    expect(deps.reserve).toHaveBeenCalledTimes(1)
    expect(records.size).toBe(0)
  })

  it('does not reuse an existing ready photo after a rejected reservation', async () => {
    const { deps, records } = harness()
    records.set('photo-1', { status: 'ready', objects: new Set(['display', 'thumb']) })
    const rejected = { ...deps, reserve: vi.fn(async () => ({ success: false as const, code: 'already_used', error: 'ID già usato' })) }
    await expect(uploadPreparedCleaningPhoto(processed, rejected)).rejects.toMatchObject({ code: 'already_used' })
    expect(records.get('photo-1')?.status).toBe('ready')
    expect(deps.upload).not.toHaveBeenCalled()
    expect(deps.abort).not.toHaveBeenCalled()
  })

  it('preserves a definitive reservation rejection without aborting a nonexistent row', async () => {
    const { deps, records } = harness()
    const rejected = { ...deps, reserve: vi.fn(async () => ({
      success: false as const, code: 'photo_limit_reached', error: 'Limite di foto raggiunto.',
    })) }
    await expect(uploadPreparedCleaningPhoto(processed, rejected)).rejects.toMatchObject({
      code: 'photo_limit_reached', message: 'Limite di foto raggiunto.', pendingPhotoId: undefined,
    })
    expect(rejected.reserve).toHaveBeenCalledTimes(1)
    expect(deps.abort).not.toHaveBeenCalled()
    expect(deps.upload).not.toHaveBeenCalled()
    expect(deps.sleep).not.toHaveBeenCalled()
    expect(records.size).toBe(0)
  })

  it('classifies unknown failures conservatively and Storage conflicts as ambiguous', () => {
    expect(classifyPhotoUploadFailure(new Error('unknown'))).toBe('definitive')
    expect(classifyPhotoUploadFailure({ status: 400, statusCode: 'Duplicate' })).toBe('ambiguous')
    expect(classifyPhotoUploadFailure({ originalError: new TypeError('fetch') })).toBe('ambiguous')
  })
})
